import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get the Presage API key
PRESAGE_API_KEY = os.getenv('PRESAGE_API_KEY')

if not PRESAGE_API_KEY:
    raise ValueError("PRESAGE_API_KEY not found in environment variables. Please check your .env file.")

