"""
╔══════════════════════════════════════════════════════════════════════════════╗
║              ForexBB Elite — server-FINAL.py                               ║
║   Python FastAPI + MetaTrader5. Deploy once, runs forever on your PC.      ║
╚══════════════════════════════════════════════════════════════════════════════╝

SETUP (one time):
    pip install fastapi uvicorn MetaTrader5 python-dotenv

RUN:
    python server-FINAL.py

CONNECTION METHODS SUPPORTED:
    A) Direct MT5  → POST /mt5/connect    { login, password, server }
    B) Meta API ID → POST /metaapi/connect { account_id }

NOTE on Meta API (Method B):
    MetaAPI requires the MetaTrader5 terminal to already be running and the
    account already authorized in the terminal. The account_id maps to the
    terminal's login. No external MetaAPI cloud token is needed — this uses
    the local Python MetaTrader5 library to find the matching account.
    If the account is already open in MT5, it connects instantly.
"""

import time
import logging
import threading
from datetime import datetime, timezone
from typing import Optional

import MetaTrader5 as mt5
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─────────────────────────────────────────────────────────────────────────────
# LOGGING — prints to console AND writes to mt5_trades.log on disk
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),                          # console
        logging.FileHandler("mt5_trades.log", mode="a"), # disk log
    ],
)
log = logging.getLogger("forexbb")

# ─────────────────────────────────────────────────────────────────────────────
# APP
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="ForexBB Elite API", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─────────────────────────────────────────────────────────────────────────────
# GLOBAL STATE
# ─────────────────────────────────────────────────────────────────────────────

class MT5State:
    connected:    bool = False
    method:       str  = ""        # "mt5" or "metaapi"
    login:        Optional[int]  = None
    account_id:   Optional[str]  = None
    lock = threading.Lock()

state = MT5State()

price_cache:      dict[str, dict] = {}
price_cache_lock: threading.Lock  = threading.Lock()

WATCHED_SYMBOLS = [
    "EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD",
    "USDCHF","NZDUSD","GBPJPY","EURJPY","EURGBP",
    "XAUUSD","XAGUSD","BTCUSD","ETHUSD","SOLUSD",
]
DISPLAY = {s: f"{s[:3]}/{s[3:]}" if len(s) == 6 else s for s in WATCHED_SYMBOLS}

# ─────────────────────────────────────────────────────────────────────────────
# MODELS
# ─────────────────────────────────────────────────────────────────────────────

class ConnectMT5Request(BaseModel):
    login:    int
    password: str
    server:   str

class ConnectMetaAPIRequest(BaseModel):
    account_id: str   # MT5 login number as string, or MetaAPI account ID

class OrderRequest(BaseModel):
    symbol:     str
    order_type: str   # "BUY" or "SELL"
    volume:     float
    sl:         float = 0.0
    tp:         float = 0.0
    comment:    str   = "ForexBB Elite"
    magic:      int   = 20240001

class CloseRequest(BaseModel):
    ticket: int

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def require_connected():
    if not state.connected:
        raise HTTPException(503, "MT5 not connected. Call /mt5/connect or /metaapi/connect first.")

def build_account_dict() -> dict:
    info = mt5.account_info()
    if not info:
        return {}
    return {
        "login":       info.login,
        "name":        info.name,
        "server":      info.server,
        "balance":     round(info.balance,     2),
        "equity":      round(info.equity,      2),
        "margin":      round(info.margin,      2),
        "freeMargin":  round(info.margin_free, 2),
        "marginLevel": round(info.margin_level, 2) if info.margin_level else 0,
        "profit":      round(info.profit,      2),
        "currency":    info.currency,
        "leverage":    info.leverage,
    }

def get_tick(symbol: str) -> Optional[dict]:
    tick = mt5.symbol_info_tick(symbol)
    if not tick:
        return None
    info   = mt5.symbol_info(symbol)
    digits = info.digits if info else 5
    mid    = round((tick.bid + tick.ask) / 2, digits)
    return {"bid": round(tick.bid, digits), "ask": round(tick.ask, digits), "mid": mid}

def get_24h(symbol: str) -> dict:
    rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_D1, 0, 2)
    if rates is None or len(rates) < 2:
        return {}
    today = rates[-1]
    prev  = rates[0]
    return {
        "high24h":   float(today["high"]),
        "low24h":    float(today["low"]),
        "change24h": round(float(today["close"]) - float(prev["close"]), 8),
    }

def get_filling_mode(symbol: str) -> int:
    info = mt5.symbol_info(symbol)
    if info and (info.filling_mode & mt5.ORDER_FILLING_IOC):
        return mt5.ORDER_FILLING_IOC
    return mt5.ORDER_FILLING_FOK

# ─────────────────────────────────────────────────────────────────────────────
# BACKGROUND PRICE THREAD
# ─────────────────────────────────────────────────────────────────────────────

def price_loop():
    while True:
        if state.connected:
            cache = {}
            for sym in WATCHED_SYMBOLS:
                p = get_tick(sym)
                if p:
                    cache[DISPLAY.get(sym, sym)] = {**p, **get_24h(sym)}
            with price_cache_lock:
                price_cache.clear()
                price_cache.update(cache)
        time.sleep(2)

threading.Thread(target=price_loop, daemon=True).start()

# ─────────────────────────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status":    "connected" if state.connected else "disconnected",
        "method":    state.method,
        "prices":    len(price_cache),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

# ── Method A — Direct MT5 credentials ─────────────────────────────────────────

@app.post("/mt5/connect")
def connect_mt5(req: ConnectMT5Request):
    with state.lock:
        if state.connected:
            mt5.shutdown()
            state.connected = False

        if not mt5.initialize():
            raise HTTPException(500, f"MT5 initialize failed: {mt5.last_error()}")

        authorized = mt5.login(req.login, password=req.password, server=req.server)
        if not authorized:
            mt5.shutdown()
            raise HTTPException(401, f"MT5 login failed: {mt5.last_error()}")

        for sym in WATCHED_SYMBOLS:
            mt5.symbol_select(sym, True)

        state.connected  = True
        state.method     = "mt5"
        state.login      = req.login

        acct = build_account_dict()
        log.info(f"✅ Connected via MT5 Direct | Login: {req.login} | Server: {req.server} | Balance: ${acct.get('balance', 0):.2f}")
        return {"connected": True, "account": acct}

# ── Method B — Meta API account ID only ───────────────────────────────────────

@app.post("/metaapi/connect")
def connect_metaapi(req: ConnectMetaAPIRequest):
    """
    Connects using a Meta API account ID.
    Since we use the local MT5 Python library (no cloud token),
    this method maps the account_id to the MT5 login already authorized
    in the running MT5 terminal. The terminal must be open and logged in.
    """
    with state.lock:
        if state.connected:
            mt5.shutdown()
            state.connected = False

        if not mt5.initialize():
            raise HTTPException(500, f"MT5 initialize failed: {mt5.last_error()}")

        # The account_id is treated as the MT5 login number
        try:
            login_num = int(req.account_id)
        except ValueError:
            mt5.shutdown()
            raise HTTPException(400, f"account_id must be a numeric MT5 login number. Got: {req.account_id}")

        # Check if this account is already active in the terminal
        info = mt5.account_info()
        if info is None or info.login != login_num:
            mt5.shutdown()
            raise HTTPException(401,
                f"Account {login_num} is not the active account in MT5 terminal. "
                f"Please open MT5, log in to account {login_num}, then retry."
            )

        for sym in WATCHED_SYMBOLS:
            mt5.symbol_select(sym, True)

        state.connected  = True
        state.method     = "metaapi"
        state.login      = login_num
        state.account_id = req.account_id

        acct = build_account_dict()
        log.info(f"✅ Connected via Meta API ID | Account: {req.account_id} | Balance: ${acct.get('balance', 0):.2f}")
        return {"connected": True, "account": acct}

# ── Disconnect ─────────────────────────────────────────────────────────────────

@app.post("/mt5/disconnect")
def disconnect():
    with state.lock:
        if state.connected:
            mt5.shutdown()
            state.connected = False
            log.info("🔌 Disconnected from MT5")
    return {"disconnected": True}

# ── Account ────────────────────────────────────────────────────────────────────

@app.get("/mt5/account")
def get_account():
    require_connected()
    acct = build_account_dict()
    if not acct:
        raise HTTPException(500, "Cannot fetch account info")
    return acct

# ── Prices ─────────────────────────────────────────────────────────────────────

@app.get("/prices")
def get_prices():
    with price_cache_lock:
        snapshot = dict(price_cache)
    if not snapshot and state.connected:
        for sym in WATCHED_SYMBOLS:
            p = get_tick(sym)
            if p:
                snapshot[DISPLAY.get(sym, sym)] = {**p, **get_24h(sym)}
    return {"prices": snapshot}

# ── Open Positions ─────────────────────────────────────────────────────────────

@app.get("/mt5/positions")
def get_positions():
    require_connected()
    pos = mt5.positions_get() or []
    return [
        {
            "ticket":      int(p.ticket),
            "symbol":      p.symbol,
            "type":        int(p.type),
            "volume":      float(p.volume),
            "price_open":  float(p.price_open),
            "price_current": float(p.price_current),
            "sl":          float(p.sl),
            "tp":          float(p.tp),
            "profit":      round(float(p.profit), 2),
            "comment":     p.comment,
            "time":        int(p.time),
            "magic":       int(p.magic),
        }
        for p in pos
    ]

# ── Place Order ────────────────────────────────────────────────────────────────

@app.post("/mt5/order")
def place_order(req: OrderRequest):
    require_connected()

    symbol = req.symbol.replace("/", "").upper()
    if not mt5.symbol_select(symbol, True):
        raise HTTPException(400, f"Symbol {symbol} not available")

    info = mt5.symbol_info(symbol)
    if not info:
        raise HTTPException(400, f"No info for {symbol}")

    volume  = max(info.volume_min, round(req.volume / info.volume_step) * info.volume_step)
    volume  = min(volume, info.volume_max)
    tick    = mt5.symbol_info_tick(symbol)
    if not tick:
        raise HTTPException(503, "No tick data")

    order_type  = mt5.ORDER_TYPE_BUY  if req.order_type.upper() == "BUY" else mt5.ORDER_TYPE_SELL
    price       = tick.ask            if req.order_type.upper() == "BUY" else tick.bid
    filling     = get_filling_mode(symbol)

    request = {
        "action":       mt5.TRADE_ACTION_DEAL,
        "symbol":       symbol,
        "volume":       volume,
        "type":         order_type,
        "price":        price,
        "sl":           req.sl  if req.sl  > 0 else 0.0,
        "tp":           req.tp  if req.tp  > 0 else 0.0,
        "deviation":    20,
        "magic":        req.magic,
        "comment":      req.comment[:31],
        "type_time":    mt5.ORDER_TIME_GTC,
        "type_filling": filling,
    }

    result = mt5.order_send(request)
    if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
        code = result.retcode if result else "None"
        msg  = result.comment if result else str(mt5.last_error())
        log.error(f"❌ Order REJECTED | {req.order_type} {symbol} {volume}lot | retcode={code} | {msg}")
        raise HTTPException(400, f"Order rejected: retcode={code} | {msg}")

    log.info(
        f"📈 ORDER SENT   | {req.order_type} {symbol} "
        f"| Ticket #{result.order} | Vol: {volume} | Price: {result.price:.5f} "
        f"| SL: {req.sl} | TP: {req.tp} | Magic: {req.magic}"
    )
    return {"ticket": int(result.order), "retcode": int(result.retcode), "comment": result.comment, "price": float(result.price)}

# ── Close Position ─────────────────────────────────────────────────────────────

@app.post("/mt5/close")
def close_position(req: CloseRequest):
    require_connected()

    positions = mt5.positions_get(ticket=req.ticket)
    if not positions:
        raise HTTPException(404, f"Position #{req.ticket} not found")

    pos         = positions[0]
    tick        = mt5.symbol_info_tick(pos.symbol)
    if not tick:
        raise HTTPException(503, "No tick data for close")

    close_type  = mt5.ORDER_TYPE_SELL if pos.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY
    close_price = tick.bid            if pos.type == mt5.ORDER_TYPE_BUY else tick.ask
    filling     = get_filling_mode(pos.symbol)

    request = {
        "action":       mt5.TRADE_ACTION_DEAL,
        "symbol":       pos.symbol,
        "volume":       pos.volume,
        "type":         close_type,
        "position":     pos.ticket,
        "price":        close_price,
        "deviation":    20,
        "magic":        pos.magic,
        "comment":      "ForexBB Close",
        "type_time":    mt5.ORDER_TIME_GTC,
        "type_filling": filling,
    }
    result = mt5.order_send(request)
    if not result or result.retcode != mt5.TRADE_RETCODE_DONE:
        code = result.retcode if result else "None"
        raise HTTPException(400, f"Close failed: retcode={code}")

    log.info(
        f"📉 POSITION CLOSED | Ticket #{req.ticket} | {pos.symbol} "
        f"| P&L: ${pos.profit:.2f} | Close price: {close_price:.5f}"
    )
    return {"closed": True, "ticket": req.ticket, "profit": round(pos.profit, 2)}

# ── Close All ──────────────────────────────────────────────────────────────────

@app.post("/mt5/close_all")
def close_all():
    require_connected()
    positions = mt5.positions_get() or []
    closed, errors = 0, []

    for pos in positions:
        try:
            tick    = mt5.symbol_info_tick(pos.symbol)
            if not tick:
                continue
            ct      = mt5.ORDER_TYPE_SELL if pos.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY
            cp      = tick.bid            if pos.type == mt5.ORDER_TYPE_BUY else tick.ask
            filling = get_filling_mode(pos.symbol)
            req     = {
                "action":       mt5.TRADE_ACTION_DEAL,
                "symbol":       pos.symbol, "volume": pos.volume,
                "type":         ct,         "position": pos.ticket,
                "price":        cp,         "deviation": 20,
                "magic":        pos.magic,  "comment": "ForexBB CloseAll",
                "type_time":    mt5.ORDER_TIME_GTC, "type_filling": filling,
            }
            r = mt5.order_send(req)
            if r and r.retcode == mt5.TRADE_RETCODE_DONE:
                log.info(f"📉 CLOSED #{pos.ticket} {pos.symbol} | P&L: ${pos.profit:.2f}")
                closed += 1
            else:
                errors.append(pos.ticket)
        except Exception as e:
            errors.append({"ticket": pos.ticket, "error": str(e)})

    log.info(f"🔴 CLOSE ALL — closed {closed} position(s) | errors: {len(errors)}")
    return {"closed": closed, "errors": errors}

# ── Trade History ──────────────────────────────────────────────────────────────

@app.get("/mt5/history")
def get_history(days: int = 7):
    require_connected()
    from datetime import timedelta
    from_dt = datetime.now() - timedelta(days=days)
    deals   = mt5.history_deals_get(from_dt, datetime.now()) or []
    return [
        {
            "ticket":     int(d.ticket),
            "symbol":     d.symbol,
            "type":       int(d.type),
            "volume":     float(d.volume),
            "price":      float(d.price),
            "profit":     round(float(d.profit), 2),
            "commission": round(float(d.commission), 2),
            "swap":       round(float(d.swap), 2),
            "comment":    d.comment,
            "time":       int(d.time),
        }
        for d in deals if d.symbol
    ]

# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    log.info("╔════════════════════════════════════════╗")
    log.info("║   ForexBB Elite — MT5 Server v3.0     ║")
    log.info("║   http://0.0.0.0:8000                 ║")
    log.info("║   Logs: mt5_trades.log                ║")
    log.info("╚════════════════════════════════════════╝")
    uvicorn.run("server-FINAL:app", host="0.0.0.0", port=8000, reload=False)
