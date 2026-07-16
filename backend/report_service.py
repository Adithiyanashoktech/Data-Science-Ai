import os
from datetime import datetime
from io import BytesIO
import pandas as pd
from typing import Dict, List, Any
# ReportLab modules for PDF generation
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

class ReportService:
    @staticmethod
    def generate_csv(data: List[Dict[str, Any]]) -> bytes:
        """Export data array to CSV bytes."""
        df = pd.DataFrame(data)
        # Reorder date to first column
        if "date" in df.columns:
            cols = ["date"] + [c for c in df.columns if c != "date"]
            df = df[cols]
        return df.to_csv(index=False).encode('utf-8')

    @staticmethod
    def generate_excel(data: List[Dict[str, Any]]) -> bytes:
        """Export data array to Excel bytes."""
        df = pd.DataFrame(data)
        if "date" in df.columns:
            cols = ["date"] + [c for c in df.columns if c != "date"]
            df = df[cols]
            
        # Clean columns to ensure compatibility with openpyxl (no timezones)
        for col in df.columns:
            try:
                # If column is timezone-aware, convert it to timezone-naive
                if pd.api.types.is_datetime64tz_dtype(df[col]):
                    df[col] = df[col].dt.tz_localize(None)
                else:
                    # Check if column values can be parsed as datetimes and localized
                    conv = pd.to_datetime(df[col], errors='ignore')
                    if pd.api.types.is_datetime64tz_dtype(conv):
                        df[col] = conv.dt.tz_localize(None)
                    elif pd.api.types.is_datetime64_any_dtype(conv):
                        df[col] = conv
            except Exception:
                pass

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="Data Agent Sheet")
        return output.getvalue()

    @staticmethod
    def generate_pdf_report(dataset_meta: Dict[str, Any], analytics: Dict[str, Any], insights: Dict[str, Any]) -> bytes:
        """Create a polished, enterprise-ready PDF report of the analysis."""
        title = dataset_meta.get("title", "Dataset Analysis")
        source = dataset_meta.get("source", "N/A")
        category = dataset_meta.get("category", "General")
        
        column = analytics.get("column", "Value")
        stats = analytics.get("statistics", {})
        trend = analytics.get("trend", {})
        anomalies = analytics.get("anomalies", [])
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=54,
            leftMargin=54,
            topMargin=54,
            bottomMargin=54
        )
        
        styles = getSampleStyleSheet()
        
        # Define clean, professional color palette
        primary_color = colors.HexColor("#1A365D") # Deep navy
        secondary_color = colors.HexColor("#2B6CB0") # Medium blue
        accent_color = colors.HexColor("#C53030") # Alert red
        text_dark = colors.HexColor("#2D3748") # Dark grey
        bg_light = colors.HexColor("#EDF2F7") # Light grey bg
        
        # Custom styles
        title_style = ParagraphStyle(
            name='DocTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=24,
            leading=28,
            textColor=primary_color,
            spaceAfter=15
        )
        
        subtitle_style = ParagraphStyle(
            name='DocSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#718096"),
            spaceAfter=25
        )
        
        h1_style = ParagraphStyle(
            name='Heading1_Custom',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=15,
            leading=18,
            textColor=primary_color,
            spaceBefore=15,
            spaceAfter=10,
            keepWithNext=True
        )
        
        body_style = ParagraphStyle(
            name='Body_Custom',
            parent=styles['BodyText'],
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            textColor=text_dark,
            spaceAfter=8
        )
        
        bullet_style = ParagraphStyle(
            name='Bullet_Custom',
            parent=styles['Bullet'],
            fontName='Helvetica',
            fontSize=10,
            leading=13,
            textColor=text_dark,
            leftIndent=20,
            spaceAfter=6
        )
        
        table_text_style = ParagraphStyle(
            name='TableText',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=11,
            textColor=text_dark
        )
        
        table_header_style = ParagraphStyle(
            name='TableHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=11,
            textColor=colors.white
        )

        elements = []
        
        # 1. Header / Title Block
        elements.append(Paragraph(title, title_style))
        meta_line = f"Category: {category}  |  Source: {source}  |  Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        elements.append(Paragraph(meta_line, subtitle_style))
        elements.append(Spacer(1, 10))
        
        # 2. Executive Summary Box
        summary_title_style = ParagraphStyle(
            name='SummaryTitle',
            fontName='Helvetica-Bold',
            fontSize=11,
            textColor=primary_color,
            spaceAfter=4
        )
        summary_text = Paragraph(insights.get("summary", "No summary available."), body_style)
        summary_data = [
            [Paragraph("EXECUTIVE SUMMARY", summary_title_style)],
            [summary_text]
        ]
        summary_table = Table(summary_data, colWidths=[doc.width])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), bg_light),
            ('TOPPADDING', (0,0), (-1,-1), 10),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
            ('LEFTPADDING', (0,0), (-1,-1), 12),
            ('RIGHTPADDING', (0,0), (-1,-1), 12),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 20))
        
        # 3. Core Statistics Section
        elements.append(Paragraph("Key Data Analytics & Metrics", h1_style))
        
        # Statistics Table
        stat_rows = [
            [Paragraph("Metric", table_header_style), Paragraph("Value", table_header_style), Paragraph("Description", table_header_style)]
        ]
        
        def safe_format(val, fmt=""):
            if val is None:
                return "N/A"
            try:
                if fmt:
                    return f"{val:{fmt}}"
                return str(val)
            except Exception:
                return str(val)

        def add_stat_row(label, val_fmt, desc):
            stat_rows.append([
                Paragraph(label, table_text_style),
                Paragraph(val_fmt, table_text_style),
                Paragraph(desc, table_text_style)
            ])
            
        add_stat_row("Observations Count", safe_format(stats.get('count'), ","), "Total number of cleaned data points in history")
        add_stat_row("Average (Mean)", safe_format(stats.get('mean'), ",.2f"), "Simple average value of primary index")
        add_stat_row("Standard Deviation", safe_format(stats.get('std'), ",.2f"), "Indicator of historical volatility and spread")
        add_stat_row("Minimum Value", safe_format(stats.get('min'), ",.2f"), "Lowest historical reading")
        add_stat_row("Maximum Value", safe_format(stats.get('max'), ",.2f"), "Highest historical reading")
        
        if stats.get("cagr") is not None:
            add_stat_row("CAGR (Annualized)", f"{safe_format(stats.get('cagr'), '.2f')}%", "Compound Annual Growth Rate")
        if stats.get("max_drawdown") is not None:
            add_stat_row("Max Drawdown", f"{safe_format(stats.get('max_drawdown'), '.2f')}%", "Peak-to-trough maximum drop")
            
        stat_table = Table(stat_rows, colWidths=[1.8*inch, 1.2*inch, doc.width - 3.0*inch])
        stat_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), primary_color),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, bg_light]),
        ]))
        elements.append(stat_table)
        elements.append(Spacer(1, 15))
        
        # 4. What Happened & Why It Happened (AI Analysis)
        elements.append(Paragraph("Market Analysis", h1_style))
        elements.append(Paragraph("<b>Historical Development:</b>", ParagraphStyle(name='SubT', parent=body_style, fontName='Helvetica-Bold')))
        elements.append(Paragraph(insights.get("what_happened", "Analysis details not available."), body_style))
        elements.append(Spacer(1, 5))
        elements.append(Paragraph("<b>Underlying Causes:</b>", ParagraphStyle(name='SubT2', parent=body_style, fontName='Helvetica-Bold')))
        elements.append(Paragraph(insights.get("why_it_happened", "Reasoning details not available."), body_style))
        elements.append(Spacer(1, 15))
        
        # 5. Key Insights
        elements.append(Paragraph("Key Takeaways & Insights", h1_style))
        for ins in (insights.get("key_insights") or []):
            elements.append(Paragraph(f"&bull; {ins}", bullet_style))
        elements.append(Spacer(1, 15))
        
        # 6. Strategic Implications
        elements.append(Paragraph("Business & Macroeconomic Implications", h1_style))
        elements.append(Paragraph(insights.get("implications", "Strategic details not available."), body_style))
        elements.append(Spacer(1, 15))
        
        # 7. Anomalies & Outliers Block (if any exist)
        if anomalies:
            elements.append(KeepTogether([
                Paragraph("Detected Anomalies & Outlier Events", h1_style),
                Paragraph("The following periods registered statistically significant anomalies, spikes, or sudden trend shifts:", body_style)
            ]))
            
            anom_rows = [
                [Paragraph("Date", table_header_style), Paragraph("Value", table_header_style), Paragraph("Type / Details", table_header_style)]
            ]
            for a in anomalies[:6]:
                type_lbl = str(a.get("type", "Shift")).capitalize()
                detail = f"Z-Score: {a.get('z_score', 0.0):.2f}" if "z_score" in a else f"Shift: {a.get('pct_change', 0.0):.2f}%"
                anom_rows.append([
                    Paragraph(str(a.get("date", "N/A")), table_text_style),
                    Paragraph(safe_format(a.get("value"), ",.2f"), table_text_style),
                    Paragraph(f"{type_lbl} ({detail})", table_text_style)
                ])
                
            anom_table = Table(anom_rows, colWidths=[1.5*inch, 1.5*inch, doc.width - 3.0*inch])
            anom_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), accent_color),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
                ('TOPPADDING', (0,0), (-1,-1), 5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 5),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, bg_light]),
            ]))
            elements.append(anom_table)
            
        # Build Document
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
