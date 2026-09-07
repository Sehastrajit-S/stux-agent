def build_notes(overview: str, steps: list) -> str:
    """Format an extracted overview + checklist steps into plain text for a
    Google Tasks note or Calendar event description: "what is it" followed by
    a checkbox-style checklist, not a prose paragraph."""
    lines = []
    if overview:
        lines.append(overview)
    if steps:
        lines.append("")
        lines.append("What needs to be done:")
        for step in steps:
            lines.append(f"☐ {step}")
    return "\n".join(lines)
