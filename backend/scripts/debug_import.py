import sys
import os
print("SYS PATH IS:")
for p in sys.path:
    print(p)
    
try:
    import supabase
    print(f"SUPABASE IS: {supabase}")
    print(f"SUPABASE FILE: {getattr(supabase, '__file__', 'no file')}")
    print(f"SUPABASE PATH: {getattr(supabase, '__path__', 'no path')}")
except ImportError as e:
    print(f"Import supabase failed: {e}")

try:
    from supabase import create_client
    print("create_client imported successfully")
except ImportError as e:
    print(f"from supabase import create_client failed: {e}")
