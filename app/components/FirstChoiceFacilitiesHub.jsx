"use client";
import { useState, useRef, useCallback, useEffect } from "react";

// ─── Brand ────────────────────────────────────────────────────────────────────
const B = {
  red:"#CC0000", redDark:"#a30000", charcoal:"#2d2d2d",
  gray:"#6b7280", border:"#e0e0e0", bg:"#f4f4f5", white:"#fff",
};

// ─── Constants ────────────────────────────────────────────────────────────────
const LOCATION_GROUPS = [
  { group:"Burroughs Restaurant Group", locations:["Collierville","Dexter","Olive Branch","Oxford","Whitehaven"] },
  { group:"First Choice",               locations:["Main Office","Warehouse"] },
  { group:"R.S. Lewis and Sons Funeral Home", locations:["Austin Peay","Vance Avenue","Walnut Grove"] },
  { group:"Misc. Facilities",           locations:["Location #1","Location #2","Location #3","Location #4","Location #5"] },
];
const CATEGORIES = [
  "HVAC / Climate Control","Plumbing / Water","Electrical / Lighting","Kitchen Equipment",
  "Refrigeration / Coolers","Flooring / Structure","Doors / Windows / Locks",
  "Parking Lot / Exterior","Pest Control","Fire / Safety Systems","Janitorial / Sanitation","Other",
];
const ACCESS_TIMES = [
  "Any time","Before 11 AM","After 2 PM","After close (evenings only)","Weekends only","By appointment — contact me first",
];
const PRIORITIES = [
  { value:"low",       label:"Low",       emoji:"🟢", badge:"#16a34a", selBg:"#dcfce7", border:"#bbf7d0", color:"#166534", descr:"Non-urgent · schedule when convenient" },
  { value:"medium",    label:"Medium",    emoji:"🟡", badge:"#d97706", selBg:"#fef3c7", border:"#fde68a", color:"#92400e", descr:"Needs attention within 48 hrs" },
  { value:"high",      label:"High",      emoji:"🔴", badge:"#dc2626", selBg:"#fee2e2", border:"#fecaca", color:"#991b1b", descr:"Impacting operations · today" },
  { value:"emergency", label:"Emergency", emoji:"🚨", badge:"#7f1d1d", selBg:"#7f1d1d", border:"#450a0a", color:"#fff", dark:true, descr:"Immediate safety / service threat" },
];
const CLOSE_STATUSES = ["Resolved","Closed","Cancelled"];
const STATUS_META = {
  "Open":         { color:"#2563eb", bg:"#eff6ff" },
  "Acknowledged": { color:"#7c3aed", bg:"#f5f3ff" },
  "In Progress":  { color:"#d97706", bg:"#fffbeb" },
  "On Hold":      { color:"#6b7280", bg:"#f9fafb" },
  "Resolved":     { color:"#16a34a", bg:"#f0fdf4" },
  "Closed":       { color:"#374151", bg:"#f3f4f6" },
  "Cancelled":    { color:"#9ca3af", bg:"#f9fafb" },
};

const EMPTY_OPEN = {
  location:"", requesterName:"", contactMethod:"", category:"",
  description:"", priority:"", safetyHazard:false,
  bestTimeToAccess:"", timeSensitive:false, neededByDate:"", photos:[],
};
const EMPTY_CLOSE = {
  workOrderId:"", techName:"", completionNotes:"", partsUsed:"",
  completionPhotos:[], status:"Resolved",
};

// ─── Utils ────────────────────────────────────────────────────────────────────
const getPri   = (v) => PRIORITIES.find((p) => p.value === v) || null;
const formatTs = () => new Date().toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true});
const genId    = () => {
  const d = new Date();
  return `FCF-${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${Math.floor(Math.random()*9000)+1000}`;
};
const readFile = (f) => new Promise(res=>{ const r=new FileReader(); r.onload=e=>res(e.target.result); r.readAsDataURL(f); });

// ─── PDF builder (returns base64 string AND triggers download) ────────────────
async function buildPDF(form, id, ts, download = true) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const W=210, M=18, CW=W-M*2;
  let y=0;

  // Header
  doc.setFillColor(204,0,0); doc.rect(0,0,W,32,"F");
  doc.setFillColor(45,45,45); doc.rect(0,32,W,8,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(22); doc.setTextColor(255,255,255);
  doc.text("FIRST CHOICE", M, 20);
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(255,200,200);
  doc.text("a global consumer products management firm", M, 28);
  doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(255,255,255);
  doc.text(form._type === "close" ? "WORK ORDER CLOSURE" : "R&M REQUEST", W-M, 16, {align:"right"});
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(255,200,200);
  doc.text(id, W-M, 23, {align:"right"});
  doc.setFont("helvetica","bold"); doc.setFontSize(7.5); doc.setTextColor(200,200,200);
  doc.text(form._type === "close" ? "CLOSURE REPORT" : "REPAIR & MAINTENANCE WORK ORDER", M, 37.5);
  doc.setFont("helvetica","normal"); doc.setTextColor(160,160,160);
  doc.text(ts, W-M, 37.5, {align:"right"});
  y = 50;

  // Safety hazard banner
  if (form.safetyHazard) {
    doc.setFillColor(204,0,0); doc.rect(M,y-6,CW,11,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(255,255,255);
    doc.text("!! SAFETY HAZARD — Escalated for immediate review", M+3, y+1.5);
    y += 14;
  }

  // Priority badge (open WO only)
  if (form.priority) {
    const meta = getPri(form.priority);
    const pColors = { low:[22,163,74], medium:[217,119,6], high:[220,38,38], emergency:[127,29,29] };
    const [r,g,bl] = pColors[form.priority] || [100,100,100];
    doc.setFillColor(r,g,bl); doc.roundedRect(M,y-6,44,11,2,2,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(255,255,255);
    doc.text(`${meta.label.toUpperCase()} PRIORITY`, M+22, y+1.5, {align:"center"});
    y += 14;
  }

  // Detail rows
  const rows = form._type === "close" ? [
    ["Work Order ID",    id],
    ["Closed At",        ts],
    ["Technician",       form.techName],
    ["Closure Status",   form.status],
    ...(form.partsUsed ? [["Parts / Materials", form.partsUsed]] : []),
  ] : [
    ["Work Order ID",    id],
    ["Submitted At",     ts],
    ["Location",         form.location],
    ["Requested By",     form.requesterName],
    ...(form.contactMethod ? [["Contact",          form.contactMethod]] : []),
    ["Category",         form.category],
    ["Priority",         getPri(form.priority)?.label || ""],
    ...(form.safetyHazard ? [["Safety Hazard","YES — flagged by requester"]] : []),
    ...(form.bestTimeToAccess ? [["Best Access Time", form.bestTimeToAccess]] : []),
    ...(form.timeSensitive && form.neededByDate
        ? [["Needed By", new Date(form.neededByDate+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})]]
        : []),
  ];

  rows.forEach(([label, value], i) => {
    const ry = y + i*11;
    const safRow = label === "Safety Hazard";
    doc.setFillColor(safRow?255:i%2===0?250:244, safRow?240:i%2===0?250:244, safRow?240:i%2===0?250:244);
    doc.rect(M,ry-4,CW,11,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(8);
    doc.setTextColor(safRow?180:100, safRow?0:100, safRow?0:100);
    doc.text(label, M+3, ry+3);
    doc.setFont("helvetica",safRow?"bold":"normal");
    doc.setTextColor(safRow?180:30, safRow?0:30, safRow?0:30);
    doc.text(value||"—", M+62, ry+3);
  });
  y += rows.length*11+10;

  // Description / Completion Notes section
  const sectionLabel = form._type === "close" ? "COMPLETION NOTES" : "DESCRIPTION OF ISSUE";
  const sectionText  = form._type === "close" ? form.completionNotes : form.description;
  doc.setFillColor(45,45,45); doc.rect(M,y-4,CW,9,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(255,255,255);
  doc.text(sectionLabel, M+3, y+1.5);
  y += 12;
  doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(30,30,30);
  const descLines = doc.splitTextToSize(sectionText||"No notes provided.", CW-6);
  doc.text(descLines, M+3, y);
  y += descLines.length*5.5+12;

  // Photos
  const photos = form._type === "close"
    ? (form.completionPhotos||[])
    : (form.photos||[]);

  if (photos.length > 0) {
    doc.setFillColor(45,45,45); doc.rect(M,y-4,CW,9,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(255,255,255);
    doc.text(`ATTACHED PHOTOS (${photos.length})`, M+3, y+1.5);
    y += 12;
    const cols = Math.min(photos.length, 2);
    const imgW = cols===1 ? Math.min(CW,110) : (CW-6)/2;
    const imgH = cols===1 ? 75 : 55;
    photos.forEach((p,i) => {
      const col=i%2, row=Math.floor(i/2);
      const xp=M+col*(imgW+3), yp=y+row*(imgH+6);
      if (yp+imgH > 285) { doc.addPage(); y=20; }
      try { doc.addImage(p.b64,"JPEG",xp,yp,imgW,imgH); }
      catch { doc.setFontSize(7); doc.setTextColor(150,150,150); doc.text(`(Photo ${i+1} unavailable)`,xp,yp+5); }
      doc.setFontSize(7); doc.setTextColor(150,150,150);
      doc.text(`Photo ${i+1}`, xp, yp+imgH+4);
    });
    y += Math.ceil(photos.length/2)*(imgH+6)+6;
  }

  // Signature lines (open WO only)
  if (form._type !== "close") {
    y = Math.max(y+10, 240);
    doc.setDrawColor(200,200,200);
    doc.line(M,y,M+75,y); doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(150,150,150);
    doc.text("Technician Signature", M, y+5);
    doc.line(M+100,y,M+175,y); doc.text("Date Completed", M+100, y+5);
  }

  // Footer
  doc.setFillColor(245,245,245); doc.rect(0,285,W,12,"F");
  doc.setFontSize(7); doc.setTextColor(180,180,180);
  doc.text("First Choice Facilities Hub · Internal Use Only · Burroughs Restaurant Group", W/2, 292, {align:"center"});

  const pdfBase64 = doc.output("datauristring");
  if (download) doc.save(`${id}.pdf`);
  return pdfBase64;
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Label({ children, required }) {
  return (
    <label style={s.label}>
      {children}
      {required && <span style={{color:B.red,marginLeft:2}}>*</span>}
    </label>
  );
}

function FInput({ value, onChange, placeholder, type="text", autoComplete="" }) {
  return (
    <input type={type} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} autoComplete={autoComplete} style={s.input} />
  );
}

function FTextarea({ value, onChange, placeholder, rows=5 }) {
  return (
    <textarea value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} rows={rows} style={s.textarea} />
  );
}

function SelectField({ value, onChange, groups, options, placeholder }) {
  return (
    <div style={{position:"relative"}}>
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{...s.input, color:value?B.charcoal:"#9ca3af", appearance:"none", WebkitAppearance:"none", paddingRight:40}}>
        <option value="" disabled hidden>{placeholder}</option>
        {groups && groups.map(g=>(
          <optgroup key={g.group} label={g.group}>
            {g.locations.map(loc=>(
              <option key={loc} value={`${g.group} — ${loc}`}>{loc}</option>
            ))}
          </optgroup>
        ))}
        {options && options.map(o=>typeof o==="string"
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
      <span style={s.chevron}>▾</span>
    </div>
  );
}

function PriorityGrid({ value, onChange }) {
  return (
    <div style={s.priorityGrid}>
      {PRIORITIES.map(p=>{
        const sel=value===p.value;
        return (
          <button key={p.value} type="button" onClick={()=>onChange(p.value)}
            style={{...s.priorityBtn, background:sel?p.selBg:"#fff", borderColor:sel?p.badge:B.border,
              boxShadow:sel?`0 0 0 2px ${p.badge}`:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <span style={{fontSize:18,lineHeight:1,flexShrink:0}}>{p.emoji}</span>
            <div style={{minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700,color:sel?(p.dark?"#fff":p.color):B.charcoal,marginBottom:2}}>{p.label}</div>
              <div style={{fontSize:11,color:sel&&p.dark?"#fca5a5":B.gray,lineHeight:1.3}}>{p.descr}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ value, onChange, label, desc, activeColor=B.red, activeIcon="⚠️", inactiveIcon="🔲" }) {
  return (
    <button type="button" onClick={()=>onChange(!value)}
      style={{...s.toggleBtn,
        background:value?"#fff5f5":"#fafafa",
        borderColor:value?activeColor:B.border,
        boxShadow:value?`0 0 0 2px ${activeColor}33`:"0 1px 3px rgba(0,0,0,0.06)"}}>
      <span style={{fontSize:22,flexShrink:0}}>{value?activeIcon:inactiveIcon}</span>
      <div style={{textAlign:"left",flex:1}}>
        <div style={{fontWeight:700,fontSize:14,color:value?activeColor:B.charcoal}}>{label}</div>
        <div style={{fontSize:12,color:B.gray,marginTop:2,lineHeight:1.4}}>{desc}</div>
      </div>
      <div style={{width:44,height:24,borderRadius:12,background:value?activeColor:"#d1d5db",position:"relative",flexShrink:0,transition:"background 0.2s"}}>
        <div style={{width:18,height:18,borderRadius:9,background:"#fff",position:"absolute",top:3,left:value?23:3,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
      </div>
    </button>
  );
}

const MAX_PHOTOS = 3;
function MultiPhoto({ photos, onChange }) {
  const ref = useRef(null);
  const handleFile = async(e) => {
    const f=e.target.files?.[0];
    if (!f||photos.length>=MAX_PHOTOS) return;
    const b64=await readFile(f);
    onChange([...photos,{b64,name:f.name}]);
    e.target.value="";
  };
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {photos.length>0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {photos.map((p,i)=>(
            <div key={i} style={s.thumbWrap}>
              <img src={p.b64} alt={`Photo ${i+1}`} style={s.thumbImg}/>
              <button type="button" onClick={()=>onChange(photos.filter((_,j)=>j!==i))} style={s.thumbX}>✕</button>
              <div style={s.thumbN}>{i+1}</div>
            </div>
          ))}
        </div>
      )}
      {photos.length<MAX_PHOTOS && (
        <button type="button" onClick={()=>ref.current?.click()} style={s.photoBtn}>
          <span style={{fontSize:26}}>📷</span>
          <span style={{fontWeight:600,color:B.charcoal}}>
            {photos.length===0?"Attach Photo":`Add Another (${photos.length}/${MAX_PHOTOS})`}
          </span>
          <span style={{fontSize:12,color:B.gray}}>Tap to take or upload · rear camera preferred</span>
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleFile}/>
    </div>
  );
}

function SinglePhoto({ photo, name, onCapture, onRemove }) {
  const ref=useRef(null);
  const handleFile=async(e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    const b64=await readFile(f); onCapture(b64,f.name); e.target.value="";
  };
  return (
    <div>
      {!photo ? (
        <button type="button" onClick={()=>ref.current?.click()} style={s.photoBtn}>
          <span style={{fontSize:26}}>📷</span>
          <span style={{fontWeight:600,color:B.charcoal}}>Attach Completion Photo</span>
          <span style={{fontSize:12,color:B.gray}}>Optional · shows finished work</span>
        </button>
      ):(
        <div style={{borderRadius:10,overflow:"hidden",border:`1.5px solid ${B.border}`}}>
          <img src={photo} alt="Completion" style={{width:"100%",maxHeight:220,objectFit:"cover",display:"block"}}/>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"#fafafa",borderTop:`1px solid ${B.border}`}}>
            <span style={{fontSize:13,color:"#555",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"75%"}}>📎 {name}</span>
            <button type="button" onClick={onRemove} style={{background:"none",border:"none",color:B.red,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✕ Remove</button>
          </div>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleFile}/>
    </div>
  );
}

function Banner({ status }) {
  if (!status) return null;
  const cfg={
    error:  {bg:"#fff5f5",bc:"#fecaca",color:"#991b1b",icon:"❌"},
    success:{bg:"#f0fdf4",bc:"#bbf7d0",color:"#166534",icon:"✅"},
    loading:{bg:"#eff6ff",bc:"#bfdbfe",color:"#1e40af",icon:null},
  }[status.type]||{};
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"13px 14px",borderRadius:10,
      border:`1.5px solid ${cfg.bc}`,background:cfg.bg,color:cfg.color,fontSize:14,fontWeight:500,marginBottom:20}}>
      {cfg.icon && <span>{cfg.icon}</span>}
      {status.type==="loading" && <span style={s.spin}/>}
      <span>{status.message}</span>
    </div>
  );
}

function StatusPill({ status, size=12 }) {
  const m=STATUS_META[status]||{color:"#6b7280",bg:"#f9fafb"};
  return (
    <span style={{padding:"2px 9px",borderRadius:20,background:m.bg,color:m.color,
      fontSize:size,fontWeight:700,letterSpacing:"0.04em",whiteSpace:"nowrap"}}>
      {status}
    </span>
  );
}

function PriorityPill({ priority }) {
  const p=getPri(priority);
  if (!p) return null;
  return (
    <span style={{padding:"2px 9px",borderRadius:20,background:p.dark?p.badge:"#fff",
      color:p.dark?"#fff":p.color,border:`1.5px solid ${p.badge}`,
      fontSize:12,fontWeight:700,letterSpacing:"0.04em",whiteSpace:"nowrap"}}>
      {p.emoji} {p.label}
    </span>
  );
}

// ─── How-To modal ─────────────────────────────────────────────────────────────
function HowTo({ onClose }) {
  const [openDevice, setOpenDevice] = useState(null); // "iphone" | "android" | null

  const IOS_STEPS = [
    "Open this app in Safari (not Chrome).",
    "Tap the Share button (square with arrow) at the bottom of the screen.",
    'Scroll down and tap "Add to Home Screen."',
    'Tap "Add" in the top-right corner. The app icon will appear on your home screen.',
  ];
  const ANDROID_STEPS = [
    "Open this app in Chrome.",
    "Tap the three-dot menu (⋮) in the top-right corner.",
    'Tap "Add to Home screen" or "Install app."',
    'Tap "Add" to confirm. The app icon will appear on your home screen.',
  ];

  const DeviceSteps = ({ id, label, icon, steps }) => {
    const open = openDevice === id;
    return (
      <div style={{borderRadius:10,border:`1.5px solid ${open?B.charcoal:B.border}`,overflow:"hidden",marginBottom:8}}>
        <button type="button" onClick={()=>setOpenDevice(open?null:id)}
          style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
            padding:"12px 14px",background:open?B.charcoal:"#fafafa",border:"none",
            cursor:"pointer",fontFamily:"inherit",gap:10}}>
          <span style={{fontSize:14,fontWeight:700,color:open?"#fff":B.charcoal}}>{icon} {label}</span>
          <span style={{fontSize:13,color:open?"#ccc":B.gray,transition:"transform 0.2s",
            display:"inline-block",transform:open?"rotate(180deg)":"rotate(0deg)"}}>▼</span>
        </button>
        {open && (
          <div style={{padding:"14px 14px 16px",display:"flex",flexDirection:"column",gap:10}}>
            {steps.map((step,i)=>(
              <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{width:26,height:26,borderRadius:13,background:B.red,color:"#fff",
                  fontSize:12,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                  {i+1}
                </div>
                <p style={{margin:0,fontSize:14,color:"#333",lineHeight:1.55}}>{step}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const sections=[
    { emoji:"📋", title:"Dashboard (Tab 1)", body:"The Dashboard pulls live work order data. It shows open vs. closed counts, priority breakdowns, and a filterable list of all work orders. Tap any card to expand its details. Use the filter bar to narrow by status, priority, or location. Data refreshes when you tap the ↻ button." },
    { emoji:"🔧", title:"Open a Work Order (Tab 2)", body:"Fill out all required fields (marked *) and tap Submit Request. A work order number is auto-generated (e.g. FCF-250601-4827). Submitting saves the work order, stores the PDF and any photos, emails the maintenance tech and supervisor, and sends a Slack alert for emergencies. You can also download the PDF directly from the success screen." },
    { emoji:"✅", title:"Close a Work Order (Tab 3)", body:"Enter the work order ID, the technician's name, completion notes, and any parts used. Select a closure status (Resolved, Closed, or Cancelled) and optionally attach a completion photo. Submitting updates the existing work order, saves a closure PDF, and sends a confirmation email to the supervisor." },
    { emoji:"⚠️", title:"Safety Hazard Flag", body:"When the Safety Hazard toggle is on, the request auto-escalates to Emergency regardless of the priority level selected. This triggers the highest-priority email and a Slack alert to the maintenance tech." },
    { emoji:"📁", title:"PDF & Photo Storage", body:"Every submitted work order PDF and photo is stored securely and linked from the work order. Closure PDFs are saved alongside the original. You never lose a record." },
    { emoji:"💡", title:"Tips", body:"• Use the Best Time to Access field so the tech knows when they can get in.\n• Attach a photo whenever possible — it speeds up diagnosis.\n• For time-sensitive repairs, set a Needed By date so it shows in the dashboard.\n• The dashboard is read-only — to update a status, submit a Close Work Order form.\n• Bookmark this app and tap Add to Home Screen for one-tap access from your phone." },
  ];
  return (
    <div style={{...s.overlay,alignItems:"flex-start",overflowY:"auto"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{...s.sheet,borderRadius:"18px 18px 0 0",maxHeight:"92vh",overflowY:"auto",paddingBottom:48}}>
        <div style={s.sheetHandle}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div>
            <div style={{fontWeight:800,fontSize:20,color:B.charcoal}}>📖 How-To Guide</div>
            <div style={{fontSize:13,color:B.gray,marginTop:2}}>First Choice Facilities Hub</div>
          </div>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <p style={{fontSize:13,color:B.gray,margin:"0 0 20px",lineHeight:1.5}}>
          Tap any section below to learn how it works.
        </p>

        {/* ── Getting Started ── */}
        <div style={{marginBottom:22,paddingBottom:22,borderBottom:`1px solid ${B.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <span style={{fontSize:22}}>📱</span>
            <span style={{fontWeight:700,fontSize:15,color:B.charcoal}}>Getting Started</span>
          </div>
          <p style={{fontSize:14,color:"#444",lineHeight:1.6,margin:"0 0 12px"}}>
            Add this app to your home screen for one-tap access — no app store required.
          </p>
          <DeviceSteps id="iphone"  label="Add to Home Screen — iPhone (Safari)" icon="🍎" steps={IOS_STEPS}/>
          <DeviceSteps id="android" label="Add to Home Screen — Android (Chrome)" icon="🤖" steps={ANDROID_STEPS}/>
        </div>

        {sections.map((sec,i)=>(
          <div key={i} style={{marginBottom:22,paddingBottom:22,borderBottom:i<sections.length-1?`1px solid ${B.border}`:"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <span style={{fontSize:22}}>{sec.emoji}</span>
              <span style={{fontWeight:700,fontSize:15,color:B.charcoal}}>{sec.title}</span>
            </div>
            <p style={{fontSize:14,color:"#444",lineHeight:1.65,margin:0,whiteSpace:"pre-line"}}>{sec.body}</p>
          </div>
        ))}
        <button onClick={onClose} style={{...s.btnRed,marginTop:4}}>Got it</button>
      </div>
    </div>
  );
}

// ─── Success screen (shared) ──────────────────────────────────────────────────
function SuccessScreen({ id, label, fields, onReset, onPDF, resetLabel="Submit Another" }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",paddingTop:28}}>
      <div style={{fontSize:60,lineHeight:1,marginBottom:14}}>✅</div>
      <h2 style={{fontSize:24,fontWeight:800,color:B.charcoal,margin:"0 0 6px"}}>{label}</h2>
      <p style={{color:B.gray,margin:"0 0 24px",fontSize:15}}>Work order {id} has been logged.</p>
      <div style={{width:"100%",borderRadius:12,border:`1.5px solid ${B.border}`,background:B.white,overflow:"hidden",marginBottom:20}}>
        <div style={{padding:"12px 16px",background:B.charcoal,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontWeight:700,fontSize:12,color:"#fff",letterSpacing:"0.06em"}}>WORK ORDER SUMMARY</span>
          <span style={{fontWeight:700,fontSize:13,color:"#ccc",fontFamily:"monospace"}}>{id}</span>
        </div>
        {fields.map(([k,v])=>v?(
          <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:"10px 16px",borderTop:`1px solid ${B.border}`,gap:12}}>
            <span style={{fontSize:12,fontWeight:600,color:B.gray,flexShrink:0}}>{k}</span>
            <span style={{fontSize:14,fontWeight:600,color:B.charcoal,textAlign:"right"}}>{v}</span>
          </div>
        ):null)}
      </div>
      <button onClick={onPDF} style={{...s.btnRed,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        ⬇️ Download PDF
      </button>
      <button onClick={onReset} style={s.btnOutline}>{resetLabel}</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — Open Work Order
// ═══════════════════════════════════════════════════════════════════════════════
function OpenWO() {
  const [form, setForm]=useState(EMPTY_OPEN);
  const [status, setStatus]=useState(null);
  const [submitted, setSubmitted]=useState(false);
  const [woId, setWoId]=useState("");
  const [savedForm, setSavedForm]=useState(null);
  const [savedTs, setSavedTs]=useState("");
  const set=(k)=>(v)=>setForm(f=>({...f,[k]:v}));

  const validate=()=>{
    if (!form.location)          return "Please select a location.";
    if (!form.requesterName.trim()) return "Please enter your name.";
    if (!form.category)          return "Please select a category.";
    if (!form.description.trim()) return "Please describe the issue.";
    if (!form.priority)          return "Please select a priority level.";
    if (form.timeSensitive && !form.neededByDate) return "Please set a needed-by date.";
    return null;
  };

  const handleSubmit=async()=>{
    const err=validate();
    if (err) { setStatus({type:"error",message:err}); return; }

    const id=genId(), ts=formatTs();
    const [locationGroup,locationSub]=form.location.includes(" — ")
      ? form.location.split(" — ") : [form.location,form.location];

    setStatus({type:"loading",message:"Submitting work order…"});

    // Build PDF as base64; the API route stores it in Supabase Storage
    const pdfBase64=await buildPDF({...form,_type:"open"},id,ts,false);
    const effectiveEmergency=form.priority==="emergency"||form.safetyHazard;

    const payload={
      formType:"rm_request", workOrderId:id, submittedAt:ts,
      location:form.location, locationGroup, locationSub,
      requesterName:form.requesterName, contactMethod:form.contactMethod||null,
      category:form.category, description:form.description,
      priority:form.priority, safetyHazard:form.safetyHazard,
      isEmergency:effectiveEmergency,
      bestTimeToAccess:form.bestTimeToAccess||null,
      timeSensitive:form.timeSensitive, neededByDate:form.timeSensitive?form.neededByDate:null,
      photos:form.photos.map(p=>({photo:p.b64,photoName:p.name})),
      photoCount:form.photos.length,
      pdfBase64,  // API route decodes this and saves to Supabase Storage
    };

    try {
      const res=await fetch("/api/work-orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setWoId(id); setSavedForm({...form,_type:"open"}); setSavedTs(ts);
      setSubmitted(true); setStatus(null);
    } catch(e) { setStatus({type:"error",message:`Submission failed: ${e.message}`}); }
  };

  const handlePDF=useCallback(()=>buildPDF({...savedForm,_type:"open"},woId,savedTs,true),[savedForm,woId,savedTs]);

  if (submitted && savedForm) {
    const pri=getPri(savedForm.priority);
    return (
      <SuccessScreen id={woId} label="Work Order Submitted"
        fields={[
          ["Location",    savedForm.location],
          ["Category",    savedForm.category],
          ["Priority",    pri?`${pri.emoji} ${pri.label}`:""],
          ["Submitted By",savedForm.requesterName],
          ...(savedForm.contactMethod?[["Contact",savedForm.contactMethod]]:[]),
          ...(savedForm.safetyHazard?[["Safety Hazard","⚠️ Flagged — escalated"]]:[]),
          ...(savedForm.timeSensitive&&savedForm.neededByDate?[["Needed By",new Date(savedForm.neededByDate+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})]]:[]),
        ]}
        onReset={()=>{setForm(EMPTY_OPEN);setSubmitted(false);setStatus(null);}}
        onPDF={handlePDF}
      />
    );
  }

  return (
    <>
      <div style={s.formHead}>
        <span style={s.formTag}>WORK ORDER</span>
        <h1 style={s.formTitle}>Open a Work Order</h1>
        <p style={s.formSub}>Fill out all required fields to submit an R&amp;M request.</p>
      </div>

      <Banner status={status}/>

      <div style={s.field}><Label required>Location</Label>
        <SelectField value={form.location} onChange={set("location")} groups={LOCATION_GROUPS} placeholder="Select organization & location…"/>
      </div>
      <div style={s.field}><Label required>Your Name</Label>
        <FInput value={form.requesterName} onChange={set("requesterName")} placeholder="First and last name" autoComplete="name"/>
      </div>
      <div style={s.field}><Label>Best Way to Reach You <Opt/></Label>
        <FInput value={form.contactMethod} onChange={set("contactMethod")} placeholder="Phone number or Slack handle" type="tel" autoComplete="tel"/>
      </div>
      <div style={s.field}><Label required>Category / Equipment Type</Label>
        <SelectField value={form.category} onChange={set("category")} options={CATEGORIES} placeholder="Select category…"/>
      </div>
      <div style={s.field}><Label required>Description of Issue</Label>
        <FTextarea value={form.description} onChange={set("description")}
          placeholder="Describe the problem — what it is, where exactly, how long it's been occurring…"/>
      </div>
      <div style={s.field}><Label required>Priority Level</Label>
        <PriorityGrid value={form.priority} onChange={set("priority")}/>
      </div>
      <div style={s.field}><Label>Safety Hazard</Label>
        <Toggle value={form.safetyHazard} onChange={set("safetyHazard")}
          label="Flag as Safety Hazard"
          desc={form.safetyHazard?"Flagged — auto-escalates to Emergency regardless of priority.":"Tap if this poses a risk to staff or customers."}
          activeColor={B.red} activeIcon="⚠️"/>
      </div>
      <div style={s.field}><Label>Best Time to Access <Opt/></Label>
        <SelectField value={form.bestTimeToAccess} onChange={set("bestTimeToAccess")} options={ACCESS_TIMES} placeholder="Select best time…"/>
      </div>
      <div style={s.field}><Label>Time-Sensitive Deadline</Label>
        <Toggle value={form.timeSensitive} onChange={set("timeSensitive")}
          label="This must be fixed by a specific date"
          desc={form.timeSensitive?"Set the date below.":"Tap to add a deadline."}
          activeColor="#d97706" activeIcon="📅"/>
        {form.timeSensitive&&(
          <input type="date" value={form.neededByDate} min={new Date().toISOString().split("T")[0]}
            onChange={e=>set("neededByDate")(e.target.value)}
            style={{...s.input,marginTop:10,color:form.neededByDate?B.charcoal:"#9ca3af"}}/>
        )}
      </div>
      <div style={s.field}><Label>Photos <Opt/> (up to 3)</Label>
        <MultiPhoto photos={form.photos} onChange={set("photos")}/>
      </div>

      <button type="button" onClick={handleSubmit}
        disabled={status?.type==="loading"}
        style={{...s.submitBtn,opacity:status?.type==="loading"?0.7:1,cursor:status?.type==="loading"?"not-allowed":"pointer"}}>
        {status?.type==="loading"?"Submitting…":"Submit Work Order"}
      </button>
      <p style={s.footNote}>First Choice Facilities Hub · Internal Use Only</p>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Close Work Order
// ═══════════════════════════════════════════════════════════════════════════════
function CloseWO() {
  const [form, setForm]=useState(EMPTY_CLOSE);
  const [status, setStatus]=useState(null);
  const [submitted, setSubmitted]=useState(false);
  const [savedForm, setSavedForm]=useState(null);
  const [savedTs, setSavedTs]=useState("");
  const [openWOs, setOpenWOs]=useState([]);
  const [woLoading, setWoLoading]=useState(false);
  const [woSearch, setWoSearch]=useState("");
  const [woDropdownOpen, setWoDropdownOpen]=useState(false);
  const woDropdownRef=useRef(null);
  const set=(k)=>(v)=>setForm(f=>({...f,[k]:v}));

  // Fetch open work orders from the API
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      setWoLoading(true);
      try {
        const res=await fetch("/api/work-orders");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data=await res.json();
        const open=(Array.isArray(data)?data:[]).filter(o=>!["Closed","Cancelled","Resolved"].includes(o.status));
        if (!cancelled) setOpenWOs(open);
      } catch(e) { /* silently fail — user can still type manually */ }
      finally { if (!cancelled) setWoLoading(false); }
    })();
    return ()=>{ cancelled=true; };
  },[]);

  // Close dropdown when clicking outside
  useEffect(()=>{
    const handler=(e)=>{
      if (woDropdownRef.current&&!woDropdownRef.current.contains(e.target)) setWoDropdownOpen(false);
    };
    document.addEventListener("mousedown",handler);
    return ()=>document.removeEventListener("mousedown",handler);
  },[]);

  const selectedWO=openWOs.find(o=>o.workOrderId===form.workOrderId);
  const filteredWOs=openWOs.filter(o=>{
    if (!woSearch) return true;
    const q=woSearch.toLowerCase();
    return (o.workOrderId||"").toLowerCase().includes(q)
      ||(o.category||"").toLowerCase().includes(q)
      ||(o.location||o.locationSub||"").toLowerCase().includes(q)
      ||(o.description||"").toLowerCase().includes(q);
  });

  const validate=()=>{
    if (!form.workOrderId.trim()) return "Please select or enter a Work Order ID.";
    if (!form.techName.trim())    return "Please enter the technician name.";
    if (!form.completionNotes.trim()) return "Please add completion notes.";
    return null;
  };

  const handleSubmit=async()=>{
    const err=validate();
    if (err) { setStatus({type:"error",message:err}); return; }

    const ts=formatTs();
    setStatus({type:"loading",message:"Submitting closure…"});

    const pdfBase64=await buildPDF({...form,_type:"close"},form.workOrderId,ts,false);

    const payload={
      formType:"wo_close",
      workOrderId:form.workOrderId.trim().toUpperCase(),
      closedAt:ts, techName:form.techName,
      completionNotes:form.completionNotes, partsUsed:form.partsUsed||null,
      status:form.status,
      completionPhotos:form.completionPhotos.map(p=>({photo:p.b64,photoName:p.name})),
      completionPhotoCount:form.completionPhotos.length,
      pdfBase64,
    };

    try {
      const res=await fetch(`/api/work-orders/${encodeURIComponent(payload.workOrderId)}/close`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedForm({...form,_type:"close"}); setSavedTs(ts);
      setSubmitted(true); setStatus(null);
    } catch(e) { setStatus({type:"error",message:`Closure failed: ${e.message}`}); }
  };

  const handlePDF=useCallback(()=>buildPDF({...savedForm,_type:"close"},savedForm.workOrderId,savedTs,true),[savedForm,savedTs]);

  if (submitted && savedForm) {
    return (
      <SuccessScreen id={savedForm.workOrderId} label="Work Order Closed"
        fields={[
          ["Status",      savedForm.status],
          ["Technician",  savedForm.techName],
          ...(savedForm.partsUsed?[["Parts Used",savedForm.partsUsed]]:[]),
        ]}
        onReset={()=>{setForm(EMPTY_CLOSE);setSubmitted(false);setStatus(null);}}
        onPDF={handlePDF}
        resetLabel="Close Another"
      />
    );
  }

  return (
    <>
      <div style={s.formHead}>
        <span style={{...s.formTag,background:"#166534"}}>CLOSURE</span>
        <h1 style={s.formTitle}>Close a Work Order</h1>
        <p style={s.formSub}>Record completion details and update the work order status.</p>
      </div>

      <Banner status={status}/>

      {/* Work Order selector */}
      <div style={s.field}>
        <Label required>Work Order ID</Label>
        {openWOs.length>0?(
          <div ref={woDropdownRef} style={{position:"relative"}}>
            <button type="button" onClick={()=>setWoDropdownOpen(v=>!v)}
              style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${woDropdownOpen?B.red:B.border}`,
                background:B.white,fontFamily:"inherit",fontSize:14,textAlign:"left",cursor:"pointer",
                display:"flex",justifyContent:"space-between",alignItems:"center",
                transition:"border-color 0.15s",color:form.workOrderId?B.charcoal:B.gray}}>
              <span>{form.workOrderId||"Select an open work order…"}</span>
              <span style={{fontSize:12,color:B.gray,flexShrink:0,marginLeft:8}}>{woDropdownOpen?"▲":"▼"}</span>
            </button>

            {woDropdownOpen&&(
              <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,marginTop:4,
                background:B.white,border:`1.5px solid ${B.border}`,borderRadius:10,
                boxShadow:"0 8px 30px rgba(0,0,0,0.12)",maxHeight:280,display:"flex",flexDirection:"column"}}>
                {/* Search */}
                <div style={{padding:"8px 10px",borderBottom:`1px solid ${B.border}`}}>
                  <input value={woSearch} onChange={e=>setWoSearch(e.target.value)}
                    placeholder="Search by ID, category, location…"
                    autoFocus
                    style={{width:"100%",padding:"8px 10px",borderRadius:7,border:`1.5px solid ${B.border}`,
                      fontFamily:"inherit",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
                {/* Options */}
                <div style={{overflowY:"auto",flex:1}}>
                  {filteredWOs.length===0?(
                    <div style={{padding:"16px 14px",textAlign:"center",color:B.gray,fontSize:13}}>
                      No matching work orders found
                    </div>
                  ):filteredWOs.map(o=>{
                    const pri=getPri(o.priority);
                    const isSel=form.workOrderId===o.workOrderId;
                    return (
                      <button key={o.workOrderId} type="button"
                        onClick={()=>{set("workOrderId")(o.workOrderId);setWoDropdownOpen(false);setWoSearch("");}}
                        style={{width:"100%",padding:"10px 14px",border:"none",borderBottom:`1px solid ${B.border}`,
                          background:isSel?"#eff6ff":"#fff",fontFamily:"inherit",fontSize:13,
                          textAlign:"left",cursor:"pointer",display:"flex",flexDirection:"column",gap:3}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontFamily:"monospace",fontWeight:700,color:B.charcoal}}>{o.workOrderId}</span>
                          <div style={{display:"flex",gap:6,alignItems:"center"}}>
                            {pri&&<span style={{fontSize:11}}>{pri.emoji}</span>}
                            <StatusPill status={o.status||"Open"}/>
                          </div>
                        </div>
                        <div style={{fontSize:12,color:B.gray}}>
                          {o.category||"Unknown"} · {o.location||o.locationSub||"—"}
                        </div>
                        {o.description&&(
                          <div style={{fontSize:12,color:"#6b7280",lineHeight:1.4,
                            overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
                            {o.description}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ):(
          /* Fallback — manual entry if no dashboard data */
          <>
            <FInput value={form.workOrderId} onChange={v=>set("workOrderId")(v.toUpperCase())} placeholder="FCF-YYMMDD-XXXX"/>
            <div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:10,padding:"10px 12px",marginTop:8,display:"flex",gap:8,alignItems:"flex-start"}}>
              <span style={{fontSize:16,flexShrink:0}}>💡</span>
              <p style={{margin:0,fontSize:12,color:"#92400e",lineHeight:1.4}}>
                {woLoading?"Loading open work orders…":"Enter the Work Order ID as it appears on the PDF, or pick from the list of open work orders."}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Selected WO preview */}
      {selectedWO&&(
        <div style={{background:"#eff6ff",border:"1.5px solid #bfdbfe",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:700,color:"#1e40af",letterSpacing:"0.05em"}}>SELECTED WORK ORDER</span>
            <button type="button" onClick={()=>set("workOrderId")("")}
              style={{background:"none",border:"none",fontSize:11,color:"#2563eb",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
              Clear
            </button>
          </div>
          <div style={{fontSize:14,fontWeight:700,color:B.charcoal,marginBottom:4}}>{selectedWO.category||"Unknown category"}</div>
          <div style={{fontSize:13,color:B.gray,marginBottom:4}}>{selectedWO.location||selectedWO.locationSub||"—"} · {selectedWO.submittedAt||""}</div>
          {selectedWO.description&&(
            <div style={{fontSize:13,color:B.charcoal,lineHeight:1.5,borderTop:`1px solid #bfdbfe`,paddingTop:8,marginTop:4}}>
              {selectedWO.description}
            </div>
          )}
        </div>
      )}
      <div style={s.field}><Label required>Technician Name</Label>
        <FInput value={form.techName} onChange={set("techName")} placeholder="First and last name" autoComplete="name"/>
      </div>
      <div style={s.field}><Label required>Completion Notes</Label>
        <FTextarea value={form.completionNotes} onChange={set("completionNotes")}
          placeholder="What was done? What was the root cause? Any follow-up needed?"/>
      </div>
      <div style={s.field}><Label>Parts / Materials Used <Opt/></Label>
        <FInput value={form.partsUsed} onChange={set("partsUsed")} placeholder="e.g. 3/4″ PVC coupling, belt drive, filter #16A…"/>
      </div>
      <div style={s.field}><Label required>Closure Status</Label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {CLOSE_STATUSES.map(st=>{
            const m=STATUS_META[st]||{};
            const sel=form.status===st;
            return (
              <button key={st} type="button" onClick={()=>set("status")(st)}
                style={{padding:"11px 8px",borderRadius:9,border:`2px solid ${sel?m.color:B.border}`,
                  background:sel?m.bg:"#fff",fontFamily:"inherit",fontSize:13,fontWeight:700,
                  color:sel?m.color:B.gray,cursor:"pointer",transition:"all 0.15s",
                  boxShadow:sel?`0 0 0 2px ${m.color}33`:"none"}}>
                {st}
              </button>
            );
          })}
        </div>
      </div>
      <div style={s.field}><Label>Completion Photos <Opt/> (up to 3)</Label>
        <MultiPhoto photos={form.completionPhotos} onChange={v=>setForm(f=>({...f,completionPhotos:v}))}/>
      </div>

      <button type="button" onClick={handleSubmit}
        disabled={status?.type==="loading"}
        style={{...s.submitBtn,background:"#166534",boxShadow:"0 4px 18px rgba(22,101,52,0.32)",
          opacity:status?.type==="loading"?0.7:1,cursor:status?.type==="loading"?"not-allowed":"pointer"}}>
        {status?.type==="loading"?"Submitting…":"Close Work Order"}
      </button>
      <p style={s.footNote}>First Choice Facilities Hub · Internal Use Only</p>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Dashboard
// ═══════════════════════════════════════════════════════════════════════════════
function Dashboard() {
  const [orders, setOrders]=useState([]);
  const [loading, setLoading]=useState(false);
  const [error, setError]=useState(null);
  const [filterStatus, setFilterStatus]=useState("All");
  const [filterPri, setFilterPri]=useState("All");
  const [filterLoc, setFilterLoc]=useState("All");
  const [expanded, setExpanded]=useState(null);
  const [lastRefresh, setLastRefresh]=useState(null);

  const fetchData=useCallback(async()=>{
    setLoading(true); setError(null);
    try {
      const res=await fetch("/api/work-orders");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data=await res.json();
      const arr=Array.isArray(data)?data:[];
      setOrders(arr);
      try { localStorage.setItem("fc_dashboard_cache",JSON.stringify(arr)); } catch {}
      setLastRefresh(new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true}));
    } catch(e) {
      // Graceful degradation: fall back to the last good data instead of a dead error screen.
      try {
        const cached=localStorage.getItem("fc_dashboard_cache");
        if (cached) setOrders(JSON.parse(cached));
      } catch {}
      setError("Couldn't refresh — showing last loaded data.");
    }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ fetchData(); },[fetchData]);

  const openOrders=orders.filter(o=>!["Closed","Cancelled","Resolved"].includes(o.status));
  const closedOrders=orders.filter(o=>["Closed","Resolved"].includes(o.status));
  const emergencyOpen=openOrders.filter(o=>o.priority==="emergency"||o.safetyHazard==="TRUE");

  const filtered=orders.filter(o=>{
    if (filterStatus!=="All"&&o.status!==filterStatus) return false;
    if (filterPri!=="All"&&o.priority!==filterPri) return false;
    if (filterLoc!=="All"&&!o.location?.includes(filterLoc)) return false;
    return true;
  }).sort((a,b)=>{
    const pri={emergency:0,high:1,medium:2,low:3};
    return (pri[a.priority]??9)-(pri[b.priority]??9);
  });

  const allLocations=[...new Set(orders.map(o=>o.locationSub||o.location).filter(Boolean))].sort();

  return (
    <div style={{display:"flex",flexDirection:"column",gap:0}}>
      {/* Title row */}
      <div style={{...s.formHead,display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <span style={s.formTag}>LIVE</span>
          <h1 style={s.formTitle}>Dashboard</h1>
          <p style={s.formSub}>
            {lastRefresh?`Last updated ${lastRefresh}`:"Live work order tracking"}
          </p>
        </div>
        <button onClick={fetchData} disabled={loading}
          style={{background:"none",border:`1.5px solid ${B.border}`,borderRadius:8,padding:"8px 12px",
            fontSize:18,cursor:"pointer",color:loading?"#ccc":B.charcoal,marginTop:4}}>
          {loading?"⏳":"↻"}
        </button>
      </div>

      {/* Error */}
      {error&&<Banner status={{type:"error",message:error}}/>}

      {/* Stat cards */}
      {orders.length>0&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            {[
              {label:"Open",      value:openOrders.length,   color:"#2563eb", bg:"#eff6ff"},
              {label:"Closed",    value:closedOrders.length, color:"#166534", bg:"#f0fdf4"},
              {label:"Emergency", value:emergencyOpen.length, color:"#7f1d1d", bg:"#fef2f2"},
              {label:"Total",     value:orders.length,        color:B.charcoal,bg:"#f3f4f6"},
            ].map(c=>(
              <div key={c.label} style={{background:c.bg,border:`1.5px solid ${c.color}22`,borderRadius:12,padding:"14px 16px"}}>
                <div style={{fontSize:28,fontWeight:800,color:c.color,lineHeight:1}}>{c.value}</div>
                <div style={{fontSize:12,fontWeight:600,color:c.color,marginTop:3,opacity:0.8}}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Priority breakdown bar */}
          {openOrders.length>0&&(
            <div style={{background:B.white,border:`1.5px solid ${B.border}`,borderRadius:12,padding:"14px 16px",marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,color:B.gray,marginBottom:10,letterSpacing:"0.05em"}}>OPEN BY PRIORITY</div>
              <div style={{display:"flex",gap:6,marginBottom:10}}>
                {PRIORITIES.map(p=>{
                  const cnt=openOrders.filter(o=>o.priority===p.value).length;
                  if (!cnt) return null;
                  const pct=Math.round((cnt/openOrders.length)*100);
                  return (
                    <div key={p.value} style={{flex:pct,background:p.badge,borderRadius:4,height:8,minWidth:8,transition:"flex 0.4s"}}/>
                  );
                })}
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:"6px 14px"}}>
                {PRIORITIES.map(p=>{
                  const cnt=openOrders.filter(o=>o.priority===p.value).length;
                  if (!cnt) return null;
                  return (
                    <span key={p.value} style={{fontSize:12,color:B.gray}}>
                      <span style={{color:p.badge,fontWeight:700}}>{p.emoji} {cnt}</span> {p.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{display:"flex",gap:8,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
            {[
              {label:"Status",  value:filterStatus, onChange:setFilterStatus, opts:["All",...Object.keys(STATUS_META)]},
              {label:"Priority",value:filterPri,    onChange:setFilterPri,    opts:["All",...PRIORITIES.map(p=>p.value)]},
              {label:"Location",value:filterLoc,    onChange:setFilterLoc,    opts:["All",...allLocations]},
            ].map(f=>(
              <div key={f.label} style={{position:"relative",flexShrink:0}}>
                <select value={f.value} onChange={e=>f.onChange(e.target.value)}
                  style={{padding:"7px 28px 7px 10px",fontSize:13,fontWeight:600,color:f.value!=="All"?B.red:B.charcoal,
                    border:`1.5px solid ${f.value!=="All"?B.red:B.border}`,borderRadius:8,
                    background:f.value!=="All"?"#fff0f0":"#fff",appearance:"none",WebkitAppearance:"none",
                    fontFamily:"inherit",cursor:"pointer"}}>
                  {f.opts.map(o=><option key={o} value={o}>{o==="All"?`All ${f.label}s`:o}</option>)}
                </select>
                <span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",fontSize:12,color:B.gray}}>▾</span>
              </div>
            ))}
          </div>

          {/* Work order list */}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filtered.length===0&&(
              <div style={{textAlign:"center",padding:"32px 0",color:B.gray,fontSize:14}}>No work orders match the current filters.</div>
            )}
            {filtered.map((o,i)=>{
              const isExp=expanded===i;
              const pri=getPri(o.priority);
              return (
                <div key={i} onClick={()=>setExpanded(isExp?null:i)}
                  style={{background:B.white,border:`1.5px solid ${isExp?B.charcoal:B.border}`,borderRadius:12,
                    overflow:"hidden",cursor:"pointer",transition:"border-color 0.15s",
                    boxShadow:isExp?"0 2px 12px rgba(0,0,0,0.08)":"none"}}>
                  {/* Card header */}
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                        <span style={{fontFamily:"monospace",fontWeight:700,fontSize:12,color:B.charcoal}}>{o.workOrderId||"—"}</span>
                        {pri&&<PriorityPill priority={o.priority}/>}
                        {(o.safetyHazard==="TRUE"||o.safetyHazard===true)&&(
                          <span style={{fontSize:11,fontWeight:700,color:B.red,background:"#fff0f0",padding:"2px 7px",borderRadius:20,border:`1px solid ${B.red}55`}}>⚠️ Hazard</span>
                        )}
                      </div>
                      <div style={{fontSize:13,fontWeight:600,color:B.charcoal,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {o.category||"Unknown category"}
                      </div>
                      <div style={{fontSize:12,color:B.gray,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {o.location||o.locationSub||"—"} · {o.submittedAt||""}
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
                      <StatusPill status={o.status||"Open"}/>
                      <span style={{fontSize:16,color:B.gray}}>{isExp?"▲":"▼"}</span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExp&&(
                    <div style={{borderTop:`1px solid ${B.border}`,padding:"14px 14px 16px",background:"#fafafa"}}>
                      {o.description&&(
                        <div style={{marginBottom:12}}>
                          <div style={{fontSize:11,fontWeight:700,color:B.gray,letterSpacing:"0.05em",marginBottom:4}}>DESCRIPTION</div>
                          <div style={{fontSize:14,color:B.charcoal,lineHeight:1.6}}>{o.description}</div>
                        </div>
                      )}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 16px"}}>
                        {[
                          ["Requested By",  o.requesterName],
                          ["Contact",       o.contactMethod],
                          ["Best Access",   o.bestTimeToAccess],
                          ["Needed By",     o.neededByDate],
                          ["Technician",    o.techName],
                          ["Parts Used",    o.partsUsed],
                          ["Completed",     o.closedAt],
                        ].filter(([,v])=>v).map(([k,v])=>(
                          <div key={k}>
                            <div style={{fontSize:11,fontWeight:600,color:B.gray}}>{k}</div>
                            <div style={{fontSize:13,color:B.charcoal,fontWeight:500}}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {o.completionNotes&&(
                        <div style={{marginTop:12}}>
                          <div style={{fontSize:11,fontWeight:700,color:B.gray,letterSpacing:"0.05em",marginBottom:4}}>COMPLETION NOTES</div>
                          <div style={{fontSize:14,color:B.charcoal,lineHeight:1.6}}>{o.completionNotes}</div>
                        </div>
                      )}
                      {o.pdfUrl&&(
                        <a href={o.pdfUrl} target="_blank" rel="noopener noreferrer"
                          style={{display:"inline-block",marginTop:12,fontSize:13,fontWeight:600,color:B.red,textDecoration:"none"}}>
                          📄 View PDF in Drive ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Loading skeleton */}
      {loading&&orders.length===0&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[1,2,3].map(i=>(
            <div key={i} style={{background:B.white,border:`1.5px solid ${B.border}`,borderRadius:12,padding:"16px 14px",height:80,
              background:"linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)",backgroundSize:"200% 100%",
              animation:"fc-shimmer 1.4s infinite"}}>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function Opt() {
  return <span style={{fontWeight:400,color:B.gray,fontSize:12}}> (optional)</span>;
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:36,height:36,borderRadius:8,background:B.red,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="9" stroke="white" strokeWidth="1.5" fill="none"/>
          <ellipse cx="11" cy="11" rx="5" ry="9" stroke="white" strokeWidth="1.5" fill="none"/>
          <line x1="2" y1="8" x2="20" y2="8" stroke="white" strokeWidth="1.2"/>
          <line x1="2" y1="14" x2="20" y2="14" stroke="white" strokeWidth="1.2"/>
          <line x1="11" y1="2" x2="11" y2="20" stroke="white" strokeWidth="1.2"/>
        </svg>
      </div>
      <div>
        <div style={{lineHeight:1,marginBottom:1}}>
          <span style={{fontWeight:800,fontSize:15,color:B.red}}>first </span>
          <span style={{fontWeight:800,fontSize:15,color:"#fff"}}>choice</span>
        </div>
        <div style={{fontSize:9.5,color:"#9ca3af"}}>Facilities Hub</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id:"dashboard", label:"Dashboard",     emoji:"📊" },
  { id:"open",      label:"Open WO",       emoji:"🔧" },
  { id:"close",     label:"Close WO",      emoji:"✅" },
  { id:"howto",     label:"How-To",        emoji:"📖" },
];

export default function FirstChoiceFacilitiesHub() {
  const [tab,      setTab]     = useState("dashboard");
  const [showHow,  setShowHow] = useState(false);

  return (
    <>
      <style>{`
        @keyframes fc-spin    { to { transform: rotate(360deg); } }
        @keyframes fc-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        * { box-sizing: border-box; }
        body { margin: 0; background: ${B.bg}; }
        input:focus, select:focus, textarea:focus {
          outline: 2px solid ${B.red} !important;
          outline-offset: 1px;
          border-color: ${B.red} !important;
        }
        button:active { opacity: 0.85; transform: scale(0.98); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }
      `}</style>

      <div style={{minHeight:"100vh",background:B.bg,fontFamily:"'Segoe UI',system-ui,-apple-system,sans-serif",display:"flex",flexDirection:"column"}}>

        {/* ── Header ── */}
        <header style={{background:B.charcoal,position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,0.3)"}}>
          <div style={{maxWidth:720,margin:"0 auto",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <Logo/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setShowHow(true)}
                style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:8,padding:"6px 10px",
                  fontSize:13,fontWeight:600,color:"#fff",cursor:"pointer",letterSpacing:"0.02em"}}>
                How-To
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{maxWidth:720,margin:"0 auto",display:"flex",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{flex:1,padding:"10px 4px",border:"none",background:"none",cursor:"pointer",fontFamily:"inherit",
                  borderBottom:tab===t.id?`3px solid ${B.red}`:"3px solid transparent",
                  transition:"border-color 0.15s"}}>
                <div style={{fontSize:16}}>{t.emoji}</div>
                <div style={{fontSize:10,fontWeight:tab===t.id?700:500,color:tab===t.id?"#fff":"#9ca3af",marginTop:2,letterSpacing:"0.03em"}}>
                  {t.label}
                </div>
              </button>
            ))}
          </div>
        </header>

        {/* ── Main ── */}
        <main style={{flex:1,maxWidth:720,width:"100%",margin:"0 auto",padding:"20px 16px 56px",display:"flex",flexDirection:"column"}}>
          {tab==="dashboard" && <Dashboard/>}
          {tab==="open"      && <OpenWO/>}
          {tab==="close"     && <CloseWO/>}
          {tab==="howto"     && <HowToPage onClose={()=>setTab("dashboard")}/>}
        </main>

        {showHow && <HowTo onClose={()=>setShowHow(false)}/>}
      </div>
    </>
  );
}

// Inline How-To page (when navigated via tab)
function HowToPage({ onClose }) {
  return <div style={{paddingBottom:20}}><HowTo onClose={onClose}/></div>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  formHead:  { marginBottom:22 },
  formTag:   { display:"inline-block",background:B.red,color:"#fff",fontSize:10,fontWeight:700,letterSpacing:"0.12em",padding:"3px 10px",borderRadius:4,marginBottom:10 },
  formTitle: { fontSize:26,fontWeight:800,color:B.charcoal,margin:"0 0 6px",letterSpacing:"-0.02em" },
  formSub:   { fontSize:14,color:B.gray,margin:0 },
  field:     { display:"flex",flexDirection:"column",gap:7,marginBottom:20 },
  label:     { fontSize:13.5,fontWeight:600,color:B.charcoal },
  input:     { width:"100%",padding:"13px 14px",fontSize:15,fontFamily:"inherit",border:`1.5px solid ${B.border}`,borderRadius:10,background:"#fff",color:B.charcoal,transition:"border-color 0.15s" },
  textarea:  { width:"100%",padding:"13px 14px",fontSize:15,fontFamily:"inherit",border:`1.5px solid ${B.border}`,borderRadius:10,background:"#fff",color:B.charcoal,resize:"vertical",lineHeight:1.55,transition:"border-color 0.15s" },
  chevron:   { position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#9ca3af",fontSize:16 },
  priorityGrid: { display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 },
  priorityBtn:  { display:"flex",alignItems:"flex-start",gap:10,padding:"13px 12px",border:"2px solid",borderRadius:10,cursor:"pointer",textAlign:"left",fontFamily:"inherit",transition:"all 0.15s" },
  toggleBtn: { display:"flex",alignItems:"center",gap:12,width:"100%",padding:"14px",border:"2px solid",borderRadius:10,cursor:"pointer",fontFamily:"inherit",textAlign:"left",transition:"all 0.15s" },
  photoBtn:  { display:"flex",flexDirection:"column",alignItems:"center",gap:7,width:"100%",padding:"24px 16px",border:`2px dashed ${B.border}`,borderRadius:10,background:"#fafafa",cursor:"pointer",fontFamily:"inherit",fontSize:14,color:B.gray },
  thumbWrap: { position:"relative",borderRadius:8,overflow:"hidden",border:`1.5px solid ${B.border}`,aspectRatio:"1",background:"#f0f0f0" },
  thumbImg:  { width:"100%",height:"100%",objectFit:"cover",display:"block" },
  thumbX:    { position:"absolute",top:5,right:5,width:24,height:24,borderRadius:12,background:"rgba(0,0,0,0.65)",color:"#fff",border:"none",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700 },
  thumbN:    { position:"absolute",bottom:5,left:7,fontSize:11,fontWeight:700,color:"#fff",textShadow:"0 1px 3px rgba(0,0,0,0.6)" },
  spin:      { display:"inline-block",width:15,height:15,border:"2.5px solid #bfdbfe",borderTopColor:"#1d4ed8",borderRadius:"50%",animation:"fc-spin 0.75s linear infinite",flexShrink:0 },
  submitBtn: { width:"100%",padding:"17px 20px",background:B.red,color:"#fff",border:"none",borderRadius:12,fontSize:17,fontWeight:700,fontFamily:"inherit",letterSpacing:"0.02em",boxShadow:"0 4px 18px rgba(204,0,0,0.32)",transition:"opacity 0.15s",marginTop:4 },
  footNote:  { textAlign:"center",color:"#c0c0c0",fontSize:11,margin:"24px 0 0" },
  btnRed:    { width:"100%",padding:"14px 20px",background:B.red,color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:700,fontFamily:"inherit",cursor:"pointer" },
  btnOutline:{ width:"100%",padding:"14px 20px",background:"#fff",color:B.charcoal,border:`1.5px solid ${B.border}`,borderRadius:10,fontSize:15,fontWeight:600,fontFamily:"inherit",cursor:"pointer" },
  overlay:   { position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",overflowY:"auto" },
  sheet:     { background:"#fff",width:"100%",maxWidth:720,margin:"0 auto",borderRadius:"18px 18px 0 0",padding:"12px 20px 40px",boxShadow:"0 -8px 40px rgba(0,0,0,0.15)" },
  sheetHandle:{ width:40,height:4,borderRadius:2,background:"#e0e0e0",margin:"0 auto 18px" },
  closeBtn:  { width:32,height:32,borderRadius:16,border:"none",background:"#f0f0f0",color:"#555",fontSize:14,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center" },
};
