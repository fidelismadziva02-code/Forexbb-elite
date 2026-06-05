import { useState, useEffect, useRef } from "react";

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const C = {
  bg:       "#080A0F",
  bgCard:   "#0D1018",
  bgDeep:   "#060810",
  gold:     "#C9A84C",
  goldBright:"#E8C46A",
  goldDim:  "#7A6030",
  goldGlow: "rgba(201,168,76,0.15)",
  green:    "#00D68F",
  greenDim: "rgba(0,214,143,0.12)",
  red:      "#FF4D6A",
  redDim:   "rgba(255,77,106,0.12)",
  blue:     "#4FC3F7",
  text:     "#E8DFC8",
  textDim:  "#6B7A8D",
  textMid:  "#9BA8B8",
  border:   "rgba(201,168,76,0.12)",
  borderMid:"rgba(201,168,76,0.25)",
};

// ── MOCK DATA ──────────────────────────────────────────────────────────────────
const ASSETS = [
  { sym:"EUR/USD", price:1.08542, bid:1.08538, ask:1.08546, chg:+0.0023, pct:+0.21, hi:1.0871, lo:1.0831, cat:"forex" },
  { sym:"GBP/USD", price:1.27183, bid:1.27179, ask:1.27187, chg:-0.0041, pct:-0.32, hi:1.2769, lo:1.2701, cat:"forex" },
  { sym:"XAU/USD", price:2341.50, bid:2341.20, ask:2341.80, chg:+12.30, pct:+0.53, hi:2355.0, lo:2328.0, cat:"metal" },
  { sym:"USD/JPY", price:149.382, bid:149.375, ask:149.389, chg:+0.412, pct:+0.28, hi:149.85, lo:148.91, cat:"forex" },
  { sym:"GBP/JPY", price:189.921, bid:189.910, ask:189.932, chg:-0.231, pct:-0.12, hi:190.55, lo:189.41, cat:"forex" },
  { sym:"BTC/USD", price:67420.0, bid:67410.0, ask:67430.0, chg:+820.0, pct:+1.23, hi:68100, lo:66200, cat:"crypto" },
  { sym:"ETH/USD", price:3512.40, bid:3511.80, ask:3513.00, chg:-45.20, pct:-1.27, hi:3588.0, lo:3477.0, cat:"crypto" },
  { sym:"AUD/USD", price:0.65124, bid:0.65120, ask:0.65128, chg:+0.0011, pct:+0.17, hi:0.6534, lo:0.6488, cat:"forex" },
];

const TRADES = [
  { id:1, pair:"EUR/USD", type:"BUY",  lot:0.10, entry:1.08412, cur:1.08542, sl:1.08200, tp:1.08700, pnl:+130.0, time:"09:14", status:"open"   },
  { id:2, pair:"XAU/USD", type:"BUY",  lot:0.05, entry:2328.50, cur:2341.50, sl:2318.00, tp:2360.00, pnl:+65.0,  time:"10:02", status:"open"   },
  { id:3, pair:"GBP/USD", type:"SELL", lot:0.10, entry:1.27390, cur:1.27183, sl:1.27600, tp:1.26900, pnl:+207.0, time:"08:47", status:"open"   },
  { id:4, pair:"USD/JPY", type:"BUY",  lot:0.10, entry:149.10,  cur:149.382, sl:148.800, tp:149.800, pnl:+19.5,  time:"11:30", status:"open"   },
  { id:5, pair:"EUR/USD", type:"SELL", lot:0.10, entry:1.09210, cur:1.08542, sl:1.09450, tp:1.08800, pnl:+668.0, time:"yesterday",status:"closed"},
  { id:6, pair:"GBP/JPY", type:"BUY",  lot:0.05, entry:189.500, cur:189.921, sl:189.000, tp:190.500, pnl:-18.5, time:"yesterday",status:"closed"},
];

const SIGNALS = [
  { id:1, pair:"EUR/USD", dir:"BUY",  conf:87, entry:1.08480, sl:1.08220, tp:1.08820, tp2:1.09100, rrr:2.4, setup:"CHoCH + Order Block", zone:"discount", confluences:["CHoCH Confirmed","Demand OB","FVG Fill","London Session"] },
  { id:2, pair:"XAU/USD", dir:"BUY",  conf:79, entry:2338.00, sl:2325.00, tp:2358.00, tp2:2378.00, rrr:1.8, setup:"Liquidity Sweep",   zone:"discount", confluences:["Liquidity Sweep","Equal Lows","Premium Zone","NY Session"] },
  { id:3, pair:"GBP/USD", dir:"SELL", conf:72, entry:1.27250, sl:1.27480, tp:1.26950, tp2:1.26650, rrr:1.5, setup:"S/R Flip",         zone:"premium",  confluences:["S/R Flip","FVG","BOS Confirmed"] },
];

const LOGS = [
  { id:1, ts:"11:42:18", type:"TRADE_OPEN",  pair:"USD/JPY", msg:"BUY 0.10 lot @ 149.10 | SL: 148.800 | TP: 149.800 | Ticket #84921" },
  { id:2, ts:"10:02:33", type:"TRADE_OPEN",  pair:"XAU/USD", msg:"BUY 0.05 lot @ 2328.50 | SL: 2318.00 | TP: 2360.00 | Ticket #84887" },
  { id:3, ts:"10:01:55", type:"SIGNAL",      pair:"XAU/USD", msg:"Liquidity Sweep | Confidence: 79% | RRR: 1.8 | Confluences: Sweep, EQL, NY Session" },
  { id:4, ts:"09:14:07", type:"TRADE_OPEN",  pair:"EUR/USD", msg:"BUY 0.10 lot @ 1.08412 | SL: 1.08200 | TP: 1.08700 | Ticket #84851" },
  { id:5, ts:"09:13:44", type:"SIGNAL",      pair:"EUR/USD", msg:"CHoCH + Order Block | Confidence: 87% | RRR: 2.4 | Confluences: CHoCH, OB, FVG, London" },
  { id:6, ts:"09:00:00", type:"CONNECT",     pair:null,      msg:"Connected via MT5 Direct | Login #482910 | Balance: $4,218.50 | Equity: $5,303.00" },
  { id:7, ts:"08:47:21", type:"TRADE_OPEN",  pair:"GBP/USD", msg:"SELL 0.10 lot @ 1.27390 | SL: 1.27600 | TP: 1.26900 | Ticket #84822" },
  { id:8, ts:"08:30:12", type:"INFO",        pair:null,      msg:"🤖 Bot started — scanning for signals on EUR/USD, GBP/USD, XAU/USD" },
];

// ── SPARKLINE ──────────────────────────────────────────────────────────────────
function Sparkline({ up, w=60, h=24 }) {
  const pts = Array.from({length:12}, (_,i) => {
    const base = 50;
    return base + (Math.sin(i*0.8 + (up?0:Math.PI)) * 12) + (Math.random()*6-3);
  });
  const min = Math.min(...pts), max = Math.max(...pts);
  const norm = pts.map(p => ((p-min)/(max-min||1))*(h-4)+2);
  const path = norm.map((y,i)=>`${i===0?"M":"L"}${(i/(pts.length-1))*(w-4)+2},${h-y}`).join(" ");
  return (
    <svg width={w} height={h} style={{overflow:"visible"}}>
      <path d={path} fill="none" stroke={up?C.green:C.red} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── MINI PNL BAR ───────────────────────────────────────────────────────────────
function PnlBar({ pct }) {
  const abs = Math.min(Math.abs(pct), 100);
  return (
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <div style={{width:60,height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
        <div style={{width:`${abs}%`,height:"100%",background:pct>=0?C.green:C.red,borderRadius:2,transition:"width 0.8s ease"}}/>
      </div>
    </div>
  );
}

// ── TOP NAV ────────────────────────────────────────────────────────────────────
function TopBar({ screen }) {
  const titles = {
    dashboard:"Dashboard", markets:"Markets",
    signals:"Signals", trades:"Live Trades",
    settings:"Bot Settings", logs:"Board Log",
  };
  return (
    <div style={{
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"16px 20px 12px", borderBottom:`1px solid ${C.border}`,
      background:C.bgDeep,
    }}>
      <div>
        <div style={{fontSize:10,color:C.goldDim,letterSpacing:3,textTransform:"uppercase",fontFamily:"'Courier New',monospace"}}>ForexBB Elite</div>
        <div style={{fontSize:20,color:C.text,fontWeight:700,fontFamily:"Georgia,serif",marginTop:1}}>{titles[screen]}</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{
          display:"flex",alignItems:"center",gap:5,
          padding:"5px 10px",borderRadius:20,
          background:C.greenDim,border:`1px solid rgba(0,214,143,0.3)`,
        }}>
          <div style={{width:6,height:6,borderRadius:"50%",background:C.green,boxShadow:`0 0 6px ${C.green}`}}/>
          <span style={{fontSize:10,color:C.green,fontWeight:700,letterSpacing:1}}>MT5 LIVE</span>
        </div>
        <div style={{
          width:34,height:34,borderRadius:"50%",
          background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:14,fontWeight:700,color:C.bg,
        }}>T</div>
      </div>
    </div>
  );
}

// ── BOTTOM NAV ─────────────────────────────────────────────────────────────────
function BottomNav({ active, setScreen }) {
  const tabs = [
    { id:"dashboard", icon:"◈", label:"Home"     },
    { id:"markets",   icon:"◎", label:"Markets"  },
    { id:"signals",   icon:"◆", label:"Signals"  },
    { id:"trades",    icon:"⇄", label:"Trades"   },
    { id:"settings",  icon:"◉", label:"Settings" },
    { id:"logs",      icon:"≡", label:"Log"      },
  ];
  return (
    <div style={{
      display:"flex", borderTop:`1px solid ${C.border}`,
      background:C.bgDeep, paddingBottom:"env(safe-area-inset-bottom,8px)",
    }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <button key={t.id} onClick={()=>setScreen(t.id)} style={{
            flex:1, display:"flex", flexDirection:"column", alignItems:"center",
            padding:"10px 4px 6px", border:"none", background:"transparent",
            cursor:"pointer", gap:3, position:"relative",
          }}>
            {isActive && <div style={{
              position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",
              width:24,height:2,borderRadius:2,
              background:`linear-gradient(90deg,transparent,${C.gold},transparent)`,
            }}/>}
            <span style={{fontSize:16,color:isActive?C.goldBright:C.textDim}}>{t.icon}</span>
            <span style={{
              fontSize:9,letterSpacing:0.5,fontWeight:isActive?700:400,
              color:isActive?C.gold:C.textDim,fontFamily:"'Courier New',monospace",
            }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ══ SCREEN: DASHBOARD ══════════════════════════════════════════════════════════
function Dashboard() {
  const [botOn, setBotOn] = useState(true);
  const openTrades = TRADES.filter(t=>t.status==="open");
  const totalPnl = openTrades.reduce((s,t)=>s+t.pnl,0);

  return (
    <div style={{flex:1,overflowY:"auto",padding:"16px 16px 8px"}}>

      {/* Account Card */}
      <div style={{
        background:`linear-gradient(135deg,#0F1318 0%,#141A24 100%)`,
        border:`1px solid ${C.borderMid}`,borderRadius:16,padding:"18px 20px",
        marginBottom:14,position:"relative",overflow:"hidden",
      }}>
        <div style={{
          position:"absolute",top:-30,right:-30,width:120,height:120,
          borderRadius:"50%",background:C.goldGlow,filter:"blur(30px)",
        }}/>
        <div style={{fontSize:10,color:C.goldDim,letterSpacing:3,marginBottom:6,fontFamily:"'Courier New',monospace"}}>ACCOUNT BALANCE</div>
        <div style={{fontSize:36,fontWeight:700,color:C.text,fontFamily:"Georgia,serif",lineHeight:1}}>$4,218<span style={{fontSize:20,color:C.textMid}}>.50</span></div>
        <div style={{display:"flex",gap:24,marginTop:14}}>
          {[
            {label:"EQUITY", val:"$5,303.00", color:C.green},
            {label:"MARGIN", val:"$892.40",   color:C.textMid},
            {label:"FREE",   val:"$4,410.60", color:C.blue},
          ].map(({label,val,color})=>(
            <div key={label}>
              <div style={{fontSize:9,color:C.textDim,letterSpacing:2,fontFamily:"'Courier New',monospace"}}>{label}</div>
              <div style={{fontSize:14,color,fontWeight:700,marginTop:2}}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
        {[
          {label:"TODAY P&L",  val:`+$${totalPnl.toFixed(0)}`, color:C.green},
          {label:"OPEN",       val:`${openTrades.length} trades`, color:C.gold},
          {label:"WIN RATE",   val:"73.2%", color:C.blue},
        ].map(({label,val,color})=>(
          <div key={label} style={{
            background:C.bgCard,border:`1px solid ${C.border}`,
            borderRadius:12,padding:"12px 10px",textAlign:"center",
          }}>
            <div style={{fontSize:8,color:C.textDim,letterSpacing:2,marginBottom:6,fontFamily:"'Courier New',monospace"}}>{label}</div>
            <div style={{fontSize:15,fontWeight:700,color}}>{val}</div>
          </div>
        ))}
      </div>

      {/* Bot Toggle */}
      <div style={{
        background:C.bgCard,border:`1px solid ${botOn?C.borderMid:C.border}`,
        borderRadius:16,padding:"16px 20px",marginBottom:14,
        display:"flex",alignItems:"center",justifyContent:"space-between",
      }}>
        <div>
          <div style={{fontSize:11,color:C.textDim,letterSpacing:1,marginBottom:3,fontFamily:"'Courier New',monospace"}}>SMC BOT ENGINE</div>
          <div style={{fontSize:15,fontWeight:700,color:botOn?C.green:C.textMid}}>
            {botOn?"● RUNNING — Scanning Markets":"○ STOPPED"}
          </div>
          {botOn && <div style={{fontSize:10,color:C.textDim,marginTop:2}}>EUR/USD · GBP/USD · XAU/USD</div>}
        </div>
        <button onClick={()=>setBotOn(v=>!v)} style={{
          width:56,height:28,borderRadius:14,border:"none",cursor:"pointer",
          background:botOn?`linear-gradient(90deg,${C.green},#00A86B)`:"rgba(255,255,255,0.08)",
          position:"relative",transition:"all 0.3s",
        }}>
          <div style={{
            position:"absolute",top:3,left:botOn?30:3,width:22,height:22,
            borderRadius:"50%",background:"white",transition:"left 0.3s",
            boxShadow:"0 1px 4px rgba(0,0,0,0.4)",
          }}/>
        </button>
      </div>

      {/* Open Positions */}
      <div style={{fontSize:10,color:C.gold,letterSpacing:3,marginBottom:10,fontFamily:"'Courier New',monospace"}}>OPEN POSITIONS</div>
      {openTrades.map(t=>(
        <div key={t.id} style={{
          background:C.bgCard,border:`1px solid ${C.border}`,
          borderRadius:12,padding:"12px 14px",marginBottom:8,
          display:"flex",alignItems:"center",justifyContent:"space-between",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{
              padding:"3px 7px",borderRadius:6,fontSize:9,fontWeight:700,
              letterSpacing:1,fontFamily:"'Courier New',monospace",
              background:t.type==="BUY"?C.greenDim:C.redDim,
              color:t.type==="BUY"?C.green:C.red,
              border:`1px solid ${t.type==="BUY"?"rgba(0,214,143,0.3)":"rgba(255,77,106,0.3)"}`,
            }}>{t.type}</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>{t.pair}</div>
              <div style={{fontSize:10,color:C.textDim}}>{t.lot} lot · {t.time}</div>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:15,fontWeight:700,color:t.pnl>=0?C.green:C.red}}>
              {t.pnl>=0?"+":""}{t.pnl.toFixed(2)}
            </div>
            <div style={{fontSize:9,color:C.textDim}}>@ {t.entry}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══ SCREEN: MARKETS ════════════════════════════════════════════════════════════
function Markets() {
  const [filter, setFilter] = useState("all");
  const cats = ["all","forex","metal","crypto"];
  const filtered = filter==="all" ? ASSETS : ASSETS.filter(a=>a.cat===filter);

  return (
    <div style={{flex:1,overflowY:"auto"}}>
      {/* Filter tabs */}
      <div style={{display:"flex",gap:8,padding:"12px 16px",borderBottom:`1px solid ${C.border}`}}>
        {cats.map(c=>(
          <button key={c} onClick={()=>setFilter(c)} style={{
            padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",
            background:filter===c?`linear-gradient(90deg,${C.gold},${C.goldDim})`:"rgba(255,255,255,0.05)",
            color:filter===c?C.bg:C.textDim,
            fontSize:10,fontWeight:700,letterSpacing:1,
            fontFamily:"'Courier New',monospace",textTransform:"uppercase",
          }}>{c}</button>
        ))}
      </div>

      <div style={{padding:"8px 16px"}}>
        {filtered.map(a=>{
          const up = a.chg >= 0;
          return (
            <div key={a.sym} style={{
              background:C.bgCard,border:`1px solid ${C.border}`,
              borderRadius:12,padding:"12px 14px",marginBottom:8,
              display:"flex",alignItems:"center",justifyContent:"space-between",
            }}>
              <div style={{display:"flex",flexDirection:"column",width:90}}>
                <div style={{fontSize:14,fontWeight:700,color:C.text}}>{a.sym}</div>
                <div style={{fontSize:9,color:C.textDim,letterSpacing:1,marginTop:1,fontFamily:"'Courier New',monospace",textTransform:"uppercase"}}>{a.cat}</div>
                <div style={{marginTop:6}}><Sparkline up={up}/></div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{fontSize:9,color:C.textDim}}>Spread</div>
                <div style={{fontSize:11,color:C.gold}}>{(a.ask-a.bid).toFixed(4)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:16,fontWeight:700,color:C.text}}>{a.price.toFixed(a.sym.includes("BTC")?0:a.sym.includes("JPY")?3:5)}</div>
                <div style={{
                  fontSize:11,fontWeight:700,color:up?C.green:C.red,marginTop:2,
                }}>
                  {up?"+":""}{a.pct.toFixed(2)}%
                </div>
                <PnlBar pct={a.pct*20}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══ SCREEN: SIGNALS ════════════════════════════════════════════════════════════
function Signals() {
  const confColor = c => c>=80?C.green:c>=65?C.gold:C.textMid;
  return (
    <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
      <div style={{fontSize:10,color:C.gold,letterSpacing:3,marginBottom:12,fontFamily:"'Courier New',monospace"}}>ACTIVE SMC SIGNALS</div>
      {SIGNALS.map(s=>(
        <div key={s.id} style={{
          background:C.bgCard,border:`1px solid ${C.border}`,
          borderRadius:14,padding:"16px",marginBottom:12,
        }}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{fontSize:16,fontWeight:700,color:C.text}}>{s.pair}</span>
                <span style={{
                  padding:"2px 8px",borderRadius:6,fontSize:9,fontWeight:700,letterSpacing:1,
                  background:s.dir==="BUY"?C.greenDim:C.redDim,
                  color:s.dir==="BUY"?C.green:C.red,
                  border:`1px solid ${s.dir==="BUY"?"rgba(0,214,143,0.3)":"rgba(255,77,106,0.3)"}`,
                  fontFamily:"'Courier New',monospace",
                }}>{s.dir}</span>
                <span style={{
                  padding:"2px 8px",borderRadius:6,fontSize:9,
                  background:"rgba(201,168,76,0.1)",color:C.gold,
                  border:`1px solid rgba(201,168,76,0.2)`,
                  fontFamily:"'Courier New',monospace",textTransform:"uppercase",
                }}>{s.zone}</span>
              </div>
              <div style={{fontSize:10,color:C.textDim}}>{s.setup}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:22,fontWeight:700,color:confColor(s.conf),lineHeight:1}}>{s.conf}<span style={{fontSize:12}}>%</span></div>
              <div style={{fontSize:9,color:C.textDim,letterSpacing:1,fontFamily:"'Courier New',monospace"}}>CONFIDENCE</div>
            </div>
          </div>

          {/* Price levels */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:12}}>
            {[
              {l:"ENTRY", v:s.entry, c:C.gold},
              {l:"SL",    v:s.sl,    c:C.red},
              {l:"TP1",   v:s.tp,    c:C.green},
              {l:"TP2",   v:s.tp2,   c:C.blue},
            ].map(({l,v,c})=>(
              <div key={l} style={{
                background:"rgba(0,0,0,0.3)",borderRadius:8,padding:"8px",textAlign:"center",
                border:`1px solid ${C.border}`,
              }}>
                <div style={{fontSize:8,color:C.textDim,letterSpacing:2,marginBottom:3,fontFamily:"'Courier New',monospace"}}>{l}</div>
                <div style={{fontSize:11,fontWeight:700,color:c}}>{v.toFixed(v>100?2:5)}</div>
              </div>
            ))}
          </div>

          {/* RRR */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:10,color:C.textDim}}>Risk/Reward</div>
            <div style={{fontSize:13,fontWeight:700,color:C.gold}}>1 : {s.rrr.toFixed(1)}</div>
          </div>

          {/* Confluences */}
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
            {s.confluences.map(c=>(
              <span key={c} style={{
                padding:"3px 8px",borderRadius:20,fontSize:9,
                background:"rgba(201,168,76,0.08)",color:C.gold,
                border:`1px solid rgba(201,168,76,0.15)`,
                fontFamily:"'Courier New',monospace",
              }}>◆ {c}</span>
            ))}
          </div>

          {/* Execute button */}
          <button style={{
            width:"100%",padding:"12px",borderRadius:10,border:"none",cursor:"pointer",
            background:`linear-gradient(90deg,${C.gold},${C.goldDim})`,
            color:C.bg,fontWeight:700,fontSize:12,letterSpacing:2,
            fontFamily:"'Courier New',monospace",
          }}>EXECUTE TRADE →</button>
        </div>
      ))}
    </div>
  );
}

// ══ SCREEN: LIVE TRADES ════════════════════════════════════════════════════════
function Trades() {
  const [tab, setTab] = useState("open");
  const shown = TRADES.filter(t=>tab==="all"||t.status===tab);
  const totalPnl = TRADES.filter(t=>t.status==="open").reduce((s,t)=>s+t.pnl,0);

  return (
    <div style={{flex:1,overflowY:"auto"}}>
      {/* Summary */}
      <div style={{
        display:"flex",justifyContent:"space-between",
        padding:"12px 20px",background:C.bgDeep,
        borderBottom:`1px solid ${C.border}`,
      }}>
        {[
          {l:"OPEN P&L",  v:`+$${totalPnl.toFixed(0)}`,   c:C.green},
          {l:"OPEN",      v:`${TRADES.filter(t=>t.status==="open").length}`,    c:C.gold},
          {l:"CLOSED",    v:`${TRADES.filter(t=>t.status==="closed").length}`,  c:C.textMid},
        ].map(({l,v,c})=>(
          <div key={l} style={{textAlign:"center"}}>
            <div style={{fontSize:8,color:C.textDim,letterSpacing:2,fontFamily:"'Courier New',monospace"}}>{l}</div>
            <div style={{fontSize:18,fontWeight:700,color:c,marginTop:2}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.border}`}}>
        {["open","closed","all"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            flex:1,padding:"10px",border:"none",cursor:"pointer",
            background:tab===t?"rgba(201,168,76,0.08)":"transparent",
            color:tab===t?C.gold:C.textDim,
            fontSize:10,fontWeight:700,letterSpacing:2,
            fontFamily:"'Courier New',monospace",textTransform:"uppercase",
            borderBottom:tab===t?`2px solid ${C.gold}`:"2px solid transparent",
          }}>{t}</button>
        ))}
      </div>

      <div style={{padding:"10px 16px"}}>
        {shown.map(t=>{
          const pnlColor = t.pnl>=0?C.green:C.red;
          return (
            <div key={t.id} style={{
              background:C.bgCard,border:`1px solid ${C.border}`,
              borderRadius:12,padding:"14px",marginBottom:8,
            }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{
                    padding:"3px 8px",borderRadius:6,fontSize:9,fontWeight:700,letterSpacing:1,
                    background:t.type==="BUY"?C.greenDim:C.redDim,
                    color:t.type==="BUY"?C.green:C.red,
                    fontFamily:"'Courier New',monospace",
                  }}>{t.type}</span>
                  <span style={{fontSize:15,fontWeight:700,color:C.text}}>{t.pair}</span>
                  <span style={{
                    padding:"2px 6px",borderRadius:4,fontSize:8,
                    background:t.status==="open"?C.greenDim:"rgba(255,255,255,0.05)",
                    color:t.status==="open"?C.green:C.textDim,
                    fontFamily:"'Courier New',monospace",textTransform:"uppercase",
                  }}>{t.status}</span>
                </div>
                <div style={{fontSize:18,fontWeight:700,color:pnlColor}}>
                  {t.pnl>=0?"+":""}{t.pnl.toFixed(2)}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                {[
                  {l:"LOT",   v:t.lot},
                  {l:"ENTRY", v:t.entry},
                  {l:"SL",    v:t.sl},
                ].map(({l,v})=>(
                  <div key={l} style={{
                    background:"rgba(0,0,0,0.3)",borderRadius:6,padding:"6px 8px",
                  }}>
                    <div style={{fontSize:7,color:C.textDim,letterSpacing:2,fontFamily:"'Courier New',monospace"}}>{l}</div>
                    <div style={{fontSize:10,color:C.textMid,fontWeight:600,marginTop:1}}>{v}</div>
                  </div>
                ))}
              </div>
              {t.status==="open" && (
                <button style={{
                  width:"100%",marginTop:10,padding:"8px",borderRadius:8,
                  border:`1px solid rgba(255,77,106,0.3)`,cursor:"pointer",
                  background:C.redDim,color:C.red,
                  fontSize:10,fontWeight:700,letterSpacing:2,
                  fontFamily:"'Courier New',monospace",
                }}>CLOSE POSITION</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══ SCREEN: BOT SETTINGS ═══════════════════════════════════════════════════════
function Settings() {
  const [method, setMethod] = useState("mt5");
  const [symbols, setSymbols] = useState(["EUR/USD","XAU/USD","GBP/USD"]);
  const [lot, setLot]       = useState("0.10");
  const [sl, setSl]         = useState("20");
  const [tp, setTp]         = useState("40");
  const [sessions, setSessions] = useState({london:true,newyork:true,asian:false});
  const [connected, setConnected] = useState(false);

  const allSyms = ["EUR/USD","GBP/USD","USD/JPY","XAU/USD","BTC/USD","ETH/USD","AUD/USD","GBP/JPY"];
  const toggleSym = s => setSymbols(v=>v.includes(s)?v.filter(x=>x!==s):[...v,s]);

  return (
    <div style={{flex:1,overflowY:"auto",padding:"14px 16px"}}>

      {/* Connection Method */}
      <div style={{marginBottom:16}}>
        <div style={{fontSize:9,color:C.gold,letterSpacing:3,marginBottom:10,fontFamily:"'Courier New',monospace"}}>CONNECTION METHOD</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[{id:"mt5",label:"MT5 Direct",sub:"Login + Password"},{id:"metaapi",label:"Meta API",sub:"Account ID Only"}].map(m=>(
            <button key={m.id} onClick={()=>setMethod(m.id)} style={{
              padding:"12px",borderRadius:10,border:"none",cursor:"pointer",
              background:method===m.id?`rgba(201,168,76,0.12)`:"rgba(255,255,255,0.03)",
              border:`1px solid ${method===m.id?C.borderMid:C.border}`,
              textAlign:"left",
            }}>
              <div style={{fontSize:11,fontWeight:700,color:method===m.id?C.gold:C.textMid}}>{m.label}</div>
              <div style={{fontSize:9,color:C.textDim,marginTop:2}}>{m.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Credentials */}
      <div style={{
        background:C.bgCard,border:`1px solid ${C.border}`,
        borderRadius:12,padding:"14px",marginBottom:16,
      }}>
        <div style={{fontSize:9,color:C.gold,letterSpacing:3,marginBottom:12,fontFamily:"'Courier New',monospace"}}>
          {method==="mt5"?"MT5 CREDENTIALS":"META API ID"}
        </div>
        {method==="mt5" ? (
          <>
            {[{p:"MT5 Login Number",t:"number"},{p:"Password",t:"password"},{p:"Broker Server (e.g. Exness-Real)",t:"text"}].map((f,i)=>(
              <input key={i} type={f.t} placeholder={f.p} style={{
                width:"100%",padding:"10px 12px",marginBottom:8,borderRadius:8,
                background:"rgba(0,0,0,0.4)",border:`1px solid ${C.border}`,
                color:C.text,fontSize:12,outline:"none",boxSizing:"border-box",
                fontFamily:"'Courier New',monospace",
              }}/>
            ))}
          </>
        ):(
          <input type="text" placeholder="Meta API Account ID" style={{
            width:"100%",padding:"10px 12px",borderRadius:8,
            background:"rgba(0,0,0,0.4)",border:`1px solid ${C.border}`,
            color:C.text,fontSize:12,outline:"none",boxSizing:"border-box",
            fontFamily:"'Courier New',monospace",
          }}/>
        )}
        <button onClick={()=>setConnected(v=>!v)} style={{
          width:"100%",padding:"12px",borderRadius:8,border:"none",cursor:"pointer",
          background:connected?`linear-gradient(90deg,${C.green},#00A86B)`:`linear-gradient(90deg,${C.gold},${C.goldDim})`,
          color:C.bg,fontWeight:700,fontSize:11,letterSpacing:2,marginTop:4,
          fontFamily:"'Courier New',monospace",
        }}>{connected?"✓ CONNECTED — SAVED":"SAVE & CONNECT"}</button>
      </div>

      {/* Symbols */}
      <div style={{marginBottom:16}}>
        <div style={{fontSize:9,color:C.gold,letterSpacing:3,marginBottom:10,fontFamily:"'Courier New',monospace"}}>TRADING SYMBOLS</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {allSyms.map(s=>{
            const on = symbols.includes(s);
            return (
              <button key={s} onClick={()=>toggleSym(s)} style={{
                padding:"6px 12px",borderRadius:20,border:"none",cursor:"pointer",
                background:on?"rgba(201,168,76,0.15)":"rgba(255,255,255,0.04)",
                color:on?C.gold:C.textDim,fontSize:10,fontWeight:700,
                border:`1px solid ${on?C.borderMid:C.border}`,
                fontFamily:"'Courier New',monospace",
              }}>{s}</button>
            );
          })}
        </div>
      </div>

      {/* Risk */}
      <div style={{
        background:C.bgCard,border:`1px solid ${C.border}`,
        borderRadius:12,padding:"14px",marginBottom:16,
      }}>
        <div style={{fontSize:9,color:C.gold,letterSpacing:3,marginBottom:12,fontFamily:"'Courier New',monospace"}}>RISK MANAGEMENT</div>
        {[{l:"Lot Size",v:lot,s:setLot},{l:"Stop Loss (pips)",v:sl,s:setSl},{l:"Take Profit (pips)",v:tp,s:setTp}].map(({l,v,s})=>(
          <div key={l} style={{marginBottom:10}}>
            <div style={{fontSize:9,color:C.textDim,marginBottom:4,letterSpacing:1,fontFamily:"'Courier New',monospace"}}>{l.toUpperCase()}</div>
            <input type="number" value={v} onChange={e=>s(e.target.value)} style={{
              width:"100%",padding:"8px 12px",borderRadius:8,
              background:"rgba(0,0,0,0.4)",border:`1px solid ${C.border}`,
              color:C.text,fontSize:13,outline:"none",boxSizing:"border-box",
              fontFamily:"'Courier New',monospace",
            }}/>
          </div>
        ))}
      </div>

      {/* Sessions */}
      <div style={{
        background:C.bgCard,border:`1px solid ${C.border}`,
        borderRadius:12,padding:"14px",marginBottom:20,
      }}>
        <div style={{fontSize:9,color:C.gold,letterSpacing:3,marginBottom:12,fontFamily:"'Courier New',monospace"}}>TRADING SESSIONS</div>
        {[{id:"london",l:"London",h:"07:00–16:00 UTC"},{id:"newyork",l:"New York",h:"12:00–21:00 UTC"},{id:"asian",l:"Asian",h:"23:00–07:00 UTC"}].map(({id,l,h})=>(
          <div key={id} style={{
            display:"flex",justifyContent:"space-between",alignItems:"center",
            paddingBottom:10,marginBottom:10,
            borderBottom:`1px solid ${C.border}`,
          }}>
            <div>
              <div style={{fontSize:12,color:C.text,fontWeight:600}}>{l}</div>
              <div style={{fontSize:9,color:C.textDim,fontFamily:"'Courier New',monospace"}}>{h}</div>
            </div>
            <button onClick={()=>setSessions(v=>({...v,[id]:!v[id]}))} style={{
              width:44,height:24,borderRadius:12,border:"none",cursor:"pointer",
              background:sessions[id]?C.green:"rgba(255,255,255,0.08)",
              position:"relative",transition:"background 0.3s",
            }}>
              <div style={{
                position:"absolute",top:2,left:sessions[id]?22:2,width:20,height:20,
                borderRadius:"50%",background:"white",transition:"left 0.3s",
              }}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══ SCREEN: BOARD LOG ══════════════════════════════════════════════════════════
function BoardLog() {
  const logColor = t => ({
    TRADE_OPEN:"#00D68F", TRADE_CLOSE:"#FF4D6A",
    SIGNAL:"#4FC3F7", CONNECT:"#C9A84C", INFO:"#6B7A8D"
  }[t]||"#6B7A8D");
  const logIcon = t => ({
    TRADE_OPEN:"▲", TRADE_CLOSE:"▼", SIGNAL:"◆", CONNECT:"⬡", INFO:"·"
  }[t]||"·");

  return (
    <div style={{flex:1,overflowY:"auto"}}>
      {/* Header */}
      <div style={{
        display:"flex",justifyContent:"space-between",alignItems:"center",
        padding:"10px 16px",borderBottom:`1px solid ${C.border}`,
        background:C.bgDeep,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:C.green,boxShadow:`0 0 6px ${C.green}`}}/>
          <span style={{fontSize:10,color:C.text,fontWeight:700,letterSpacing:2,fontFamily:"'Courier New',monospace"}}>LIVE BOARD LOG</span>
        </div>
        <span style={{fontSize:9,color:C.textDim,fontFamily:"'Courier New',monospace"}}>{LOGS.length} ENTRIES</span>
      </div>

      {/* Legend */}
      <div style={{
        display:"flex",gap:14,padding:"8px 16px",
        borderBottom:`1px solid ${C.border}`,background:C.bgDeep,
      }}>
        {[["TRADE_OPEN","Open"],["TRADE_CLOSE","Close"],["SIGNAL","Signal"],["CONNECT","Connect"]].map(([t,l])=>(
          <div key={t} style={{display:"flex",alignItems:"center",gap:3}}>
            <span style={{fontSize:9,color:logColor(t)}}>{logIcon(t)}</span>
            <span style={{fontSize:8,color:C.textDim,fontFamily:"'Courier New',monospace"}}>{l}</span>
          </div>
        ))}
      </div>

      {/* Log entries */}
      <div style={{padding:"8px 0"}}>
        {LOGS.map(entry=>(
          <div key={entry.id} style={{
            display:"flex",alignItems:"flex-start",gap:8,
            padding:"8px 16px",
            borderBottom:`1px solid rgba(255,255,255,0.03)`,
          }}>
            <span style={{fontSize:11,color:logColor(entry.type),marginTop:1,width:10}}>{logIcon(entry.type)}</span>
            <span style={{
              fontSize:10,color:C.textDim,width:58,flexShrink:0,
              fontFamily:"'Courier New',monospace",marginTop:1,
            }}>{entry.ts}</span>
            {entry.pair && (
              <span style={{
                fontSize:10,fontWeight:700,color:logColor(entry.type),
                width:52,flexShrink:0,marginTop:1,
              }}>{entry.pair}</span>
            )}
            <span style={{
              fontSize:10,color:"#C5D0E0",lineHeight:1.5,flex:1,
            }}>{entry.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══ ROOT APP ═══════════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState("dashboard");

  const screens = {
    dashboard: <Dashboard/>,
    markets:   <Markets/>,
    signals:   <Signals/>,
    trades:    <Trades/>,
    settings:  <Settings/>,
    logs:      <BoardLog/>,
  };

  return (
    <div style={{
      width:390, height:844,
      display:"flex", flexDirection:"column",
      background:C.bg, color:C.text,
      fontFamily:"'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif",
      overflow:"hidden", borderRadius:44,
      boxShadow:"0 40px 120px rgba(0,0,0,0.9), 0 0 0 1px rgba(201,168,76,0.2)",
      position:"relative",
    }}>
      {/* Phone notch */}
      <div style={{
        position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",
        width:120,height:28,background:C.bg,borderRadius:"0 0 20px 20px",
        zIndex:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
      }}>
        <div style={{width:10,height:10,borderRadius:"50%",background:"#1A1A1A"}}/>
        <div style={{width:60,height:8,borderRadius:4,background:"#1A1A1A"}}/>
      </div>

      <div style={{height:28,background:C.bgDeep,flexShrink:0}}/>
      <TopBar screen={screen}/>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
        {screens[screen]}
      </div>
      <BottomNav active={screen} setScreen={setScreen}/>
    </div>
  );
}
