// Work order PDF builder, shared by the hub UI (app/components/FirstChoiceFacilitiesHub.jsx)
// and scripts/backfill-pdfs. Plain ESM with no browser-only APIs so it runs in Node too.

export const PRIORITIES = [
  { value:"low",       label:"Low",       badge:"#15803D", selBg:"#F0FDF4", border:"#BBF7D0", color:"#14532D", descr:"Non-urgent · schedule when convenient" },
  { value:"medium",    label:"Medium",    badge:"#B45309", selBg:"#FFFBEB", border:"#FDE68A", color:"#78350F", descr:"Needs attention within 48 hrs" },
  { value:"high",      label:"High",      badge:"#CC0000", selBg:"#FFF1F1", border:"#FECACA", color:"#8C0000", descr:"Impacting operations · today" },
  { value:"emergency", label:"Emergency", badge:"#7F1D1D", selBg:"#7F1D1D", border:"#450A0A", color:"#fff", dark:true, descr:"Immediate safety / service threat" },
];

export const getPri = (v) => PRIORITIES.find((p) => p.value === v) || null;

// Format a datetime-local value for display without shifting time zones.
export const fmtLocalDT = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v||"");
  if (!m) return "";
  return new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])).toLocaleString("en-US",{timeZone:"UTC",month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true});
};
export const localHours = (a, b) => {
  const ms = new Date(`${b}:00Z`).getTime() - new Date(`${a}:00Z`).getTime();
  return isNaN(ms) ? "" : (ms/3600000).toFixed(2);
};

// ─── PDF builder (returns base64 string AND triggers download) ────────────────
export async function buildPDF(form, id, ts, download = true) {
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
    ...(form.timeIn ? [["Time In", fmtLocalDT(form.timeIn)]] : []),
    ...(form.timeOut ? [["Time Out", fmtLocalDT(form.timeOut)]] : []),
    ...(form.timeIn && form.timeOut ? [["Hours", localHours(form.timeIn, form.timeOut)]] : []),
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
