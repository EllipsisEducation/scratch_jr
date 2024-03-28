# from resize_png import resize_png
from fix_svg import fix_svg_file

base_path = 'editions/free/src/svglibrary/'

import os
def swap_file_names(file1, file2):
    try:
        # Check if both files exist
        if os.path.exists(file1) and os.path.exists(file2):
            # Generate temporary file name to avoid conflicts
            temp_file = file1 + "_temp"

            # Rename file1 to a temporary name
            os.rename(file1, temp_file)

            # Rename file2 to file1's original name
            os.rename(file2, file1)

            # Rename file1 (now temp_file) to file2's original name
            os.rename(temp_file, file2)

            print(f"Swapped names of {file1} and {file2}")

        else:
            print("Both files must exist to swap their names.")

    except Exception as e:
        print(f"Error: {e}")

io = [
    ('Scout-face-left.svg', '_Scout-face-left.svg'),
    ('Scout-face-right.svg', '_Scout-face-right.svg'),
    ('Scout-point-left.svg', '_Scout-point-left.svg'),
    ('Scout-point-right.svg', '_Scout-point-right.svg'),
    ('Scout-walk-left-1.svg', '_Scout-walk-left-1.svg'),
    ('Scout-walk-right-1.svg', '_Scout-walk-right-1.svg'),
    ('Scout-walk-left-2.svg', '_Scout-walk-left-2.svg'),
    ('Scout-walk-right-2.svg', '_Scout-walk-right-2.svg'),
]

if __name__ == "__main__":
    for i, o in io:
        input_path = base_path + i
        output_path = base_path + o
        print(f"Fixing {input_path} to {output_path}")
        fix_svg_file(input_path, output_path, scale=0.5)
        print('Fixed SVG file. Swapping names...')
        swap_file_names(input_path, output_path)
        print('Done!')
        print()
