def classify_section_type(title: str, section_path: str = "") -> str:
    text = f"{section_path} {title}".lower()
    if "项目概况" in text:
        return "project_overview"
    if "质量保证" in text or "质量管理" in text:
        return "quality_assurance"
    if "安全" in text:
        return "safety_management"
    if "施工组织" in text or "技术方案" in text:
        return "technical_plan"
    return "general_section"
