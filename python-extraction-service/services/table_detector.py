import camelot

def detect_tables(pdf_path):
    """
    Detect and extract tables from PDF
    
    Args:
        pdf_path: Path to PDF file
        
    Returns:
        list: List of detected tables
    """
    try:
        # Try stream flavor first (for borderless tables)
        tables = camelot.read_pdf(pdf_path, pages='all', flavor='stream')
        
        if len(tables) == 0:
            # Fallback to lattice flavor (for bordered tables)
            tables = camelot.read_pdf(pdf_path, pages='all', flavor='lattice')
        
        return tables
    
    except Exception as e:
        print(f"Table detection error: {e}")
        return []

def extract_table_data(table):
    """
    Extract data from a single table
    
    Args:
        table: Camelot table object
        
    Returns:
        list: Table data as list of rows
    """
    try:
        df = table.df
        return df.values.tolist()
    except Exception as e:
        print(f"Table extraction error: {e}")
        return []

# Export
__all__ = ['detect_tables', 'extract_table_data']
