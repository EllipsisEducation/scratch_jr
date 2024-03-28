import argparse
from PIL import Image

def resize_png(input_path, output_path, scale_factor):
    try:
        # Open the PNG image
        image = Image.open(input_path)

        # Calculate the new dimensions based on the scale factor
        new_width = int(image.width * scale_factor)
        new_height = int(image.height * scale_factor)

        # Resize the image
        resized_image = image.resize((new_width, new_height), Image.ANTIALIAS)

        # Save the resized image as a PNG
        resized_image.save(output_path, "PNG")

        print(f"Image resized and saved as {output_path}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Resize a PNG image by a given factor')
    parser.add_argument('input_file', help='Relative path to the input PNG file.')
    parser.add_argument('--output', default='output.png', help='Relative path to the output PNG file (default: output.png).')
    parser.add_argument('--scale', type=float, default=0.5, help='Scaling factor (default: 0.5 for 50%).')
    args = parser.parse_args()
    input_png_path = args.input_file
    output_png_path = args.output
    scale_factor = args.scale
    resize_png(input_png_path, output_png_path, scale_factor)
