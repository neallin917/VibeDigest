import sys
import os
print("CWD:", os.getcwd())
print("Sys Path:", sys.path)
try:
    import supabase
    print("Supabase file:", getattr(supabase, '__file__', 'No generic file'))
    print("Supabase path:", getattr(supabase, '__path__', 'No path'))
    print("Dir:", dir(supabase))
except ImportError as e:
    print("Import Error:", e)
