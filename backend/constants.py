from enum import Enum

class OutputKind(str, Enum):
    SCRIPT = "script"
    SCRIPT_RAW = "script_raw"
    AUDIO = "audio"
    CLASSIFICATION = "classification"
    SUMMARY = "summary"
    COMPREHENSION_BRIEF = "comprehension_brief"
    
class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"
