import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
    NextPageTemplate, PageBreak, KeepTogether, Table, TableStyle, CondPageBreak)
from reportlab.platypus.flowables import HRFlowable

D="/usr/share/fonts/truetype/dejavu/"
L="/usr/share/fonts/truetype/sand-box/google/Lato/"
pdfmetrics.registerFont(TTFont("S", L+"Lato-Regular.ttf"))
pdfmetrics.registerFont(TTFont("SB", L+"Lato-Bold.ttf"))
pdfmetrics.registerFont(TTFont("SI", L+"Lato-Italic.ttf"))
pdfmetrics.registerFont(TTFont("SBI", L+"Lato-BoldItalic.ttf"))
pdfmetrics.registerFont(TTFont("DJ", D+"DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("SR", D+"DejaVuSerif-Bold.ttf"))
from reportlab.lib.fonts import addMapping
addMapping("S",0,0,"S");addMapping("S",1,0,"SB");addMapping("S",0,1,"SI");addMapping("S",1,1,"SBI")

RED=colors.HexColor("#c8102e"); BLACK=colors.HexColor("#111111"); CREAM=colors.HexColor("#f6f0e4"); INK=colors.HexColor("#1d1a17"); MUTED=colors.HexColor("#6b625a")
W,H=A4
SRC="Mercatus-Concierge-Cold-Call-Pitch-Playbook.md"; OUT="Mercatus-Concierge-Cold-Call-Pitch-Playbook.pdf"

body=ParagraphStyle("b",fontName="S",fontSize=10,leading=14,textColor=INK,spaceAfter=5)
bullet=ParagraphStyle("bl",parent=body,leftIndent=14,bulletIndent=3,spaceAfter=3)
h2=ParagraphStyle("h2",fontName="SR",fontSize=15,leading=19,textColor=colors.white)
h3=ParagraphStyle("h3",fontName="SB",fontSize=11,leading=15,textColor=RED,spaceBefore=9,spaceAfter=4)
speaker=ParagraphStyle("sp",parent=body,leftIndent=10,borderPadding=0)
note=ParagraphStyle("n",parent=body,textColor=MUTED,fontName="SI")

def inline(t):
    t=t.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
    t=re.sub(r"\*\*(.+?)\*\*",r"<b>\1</b>",t)
    t=re.sub(r"(?<![\w*])\*(.+?)\*(?!\w)",r"<i>\1</i>",t)
    t=re.sub(r"(https?://[^\s)]+?)([.,]?)(?=\s|\)|$)",r'<link href="\1" color="#c8102e"><u>\1</u></link>\2',t)
    t=t.replace("→",'<font name="DJ">→</font>')
    return t

def h2block(text):
    tb=Table([[Paragraph(inline(text),h2)]],colWidths=[W-40*mm])
    tb.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),BLACK),("LINEBELOW",(0,0),(-1,-1),2.5,RED),
        ("LEFTPADDING",(0,0),(-1,-1),10),("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),8)]))
    return tb

lines=open(SRC,encoding="utf-8").read().splitlines()
title=lines[0][2:]; subtitle=lines[2].strip("*"); dateline=lines[4]; tagline=lines[6][2:]
story=[NextPageTemplate("body"),PageBreak()]
first=True
for ln in lines[7:]:
    s=ln.strip()
    if not s: continue
    if s.startswith("## "):
        if not first: story.append(CondPageBreak(60*mm))
        first=False
        story+= [Spacer(1,6),h2block(s[3:]),Spacer(1,8)]
    elif s.startswith("### "):
        story.append(CondPageBreak(30*mm)); story.append(Paragraph(inline(s[4:]),h3))
    elif s.startswith("- "):
        story.append(Paragraph(inline(s[2:]),bullet,bulletText="•"))
    elif s=="---":
        story+= [Spacer(1,10),HRFlowable(width="100%",color=RED,thickness=1),Spacer(1,4)]
    elif s.startswith("**CALLER:**"):
        p=Paragraph('<font color="#c8102e"><b>CALLER</b></font>&nbsp;&nbsp;'+inline(s[11:].strip()),speaker)
        tb=Table([[p]],colWidths=[W-40*mm]); tb.setStyle(TableStyle([("LINEBEFORE",(0,0),(0,-1),2,RED),
            ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#efe6d4")),("LEFTPADDING",(0,0),(-1,-1),8),
            ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),1)]))
        story+=[tb,Spacer(1,4)]
    elif s.startswith("*") and s.endswith("*") and not s.startswith("**"):
        story.append(Paragraph(inline(s[1:-1]),note))
    elif s.startswith("**“") and s.endswith("**"):
        story.append(Paragraph('<font color="#c8102e">Objection:</font> '+inline(s),ParagraphStyle("o",parent=body,fontName="SB",spaceBefore=6)))
    else:
        story.append(Paragraph(inline(s),body))

def cover(c,doc):
    c.setFillColor(BLACK); c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(RED); c.rect(0,H-14*mm,W,4,fill=1,stroke=0); c.rect(20*mm,95*mm,40*mm,3,fill=1,stroke=0)
    c.setFillColor(CREAM); c.setFont("SB",10); c.drawString(20*mm,H-30*mm,"MENS MERCATUS")
    c.setFont("SR",30); y=H*0.58
    for part in ["Mercatus Concierge —","Cold-Call Pitch","Playbook"]:
        c.drawString(20*mm,y,part); y-=38
    c.setFont("S",12); c.setFillColor(colors.HexColor("#d9cfbd"))
    c.drawString(20*mm,y-10,subtitle)
    c.setFillColor(RED); c.setFont("SI",15); c.drawString(20*mm,80*mm,tagline)
    c.setFillColor(CREAM); c.setFont("S",10); c.drawString(20*mm,68*mm,dateline)
    c.setFont("S",8); c.setFillColor(colors.HexColor("#8a8076"))
    c.drawString(20*mm,20*mm,"Practice & sales enablement document. Thandi is a simulated cold-call persona, not a real client.")
def page(c,doc):
    c.setFillColor(CREAM); c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(BLACK); c.rect(0,H-12*mm,W,12*mm,fill=1,stroke=0)
    c.setFillColor(RED); c.rect(0,H-12*mm-2,W,2,fill=1,stroke=0)
    c.setFillColor(CREAM); c.setFont("SB",8); c.drawString(20*mm,H-7.5*mm,"MERCATUS CONCIERGE")
    c.setFont("S",8); c.drawRightString(W-20*mm,H-7.5*mm,"Cold-Call Pitch Playbook · 2026-10-07")
    c.setFillColor(MUTED); c.setFont("S",7.5)
    c.drawString(20*mm,10*mm,"Your digital footprint. One concierge.")
    c.drawRightString(W-20*mm,10*mm,f"{doc.page}")

doc=BaseDocTemplate(OUT,pagesize=A4,title=title,author="Mens Mercatus",subject=subtitle)
fr=Frame(20*mm,18*mm,W-40*mm,H-40*mm,id="f",leftPadding=0,rightPadding=0)
doc.addPageTemplates([PageTemplate("cover",[Frame(0,0,W,H)],onPage=cover),PageTemplate("body",[fr],onPage=page)])
doc.build(story)
