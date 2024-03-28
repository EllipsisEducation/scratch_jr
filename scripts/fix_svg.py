import argparse
import subprocess
import xml.etree.ElementTree as ET
from collections import defaultdict

# See https://www.notion.so/codehs/Scratch-ScratchJr-fae5d776041d479c914dc8fddc80517b?pvs=4#b54bef0321664e03b73c9d3e58b5808f

def clean_command_string(command_string, scale_x=None, scale_y=None):
    # Run the Node.js script and capture stdout and stderr
    node_command = ['node', 'scripts/transform-svg.js', command_string]
    if scale_x is not None:
        node_command.append(str(scale_x))
    if scale_y is not None:
        node_command.append(str(scale_y))
    result = subprocess.run(
        node_command,
        capture_output=True,
        text=True,
        check=True
    )

    # Check the return code (0 means success)
    if result.returncode == 0:
        # Clean script succeeded
        return result.stdout

    else:
        # Clean script failed
        raise Exception(f'Clean script failed with error:\n{result.stderr}')


def scale_circles(root, scale):
    if scale is None:
        return
    
    for circle in root.iter('{http://www.w3.org/2000/svg}circle'):
        if 'cx' in circle.attrib:
            cx = float(circle.attrib['cx'])
            circle.attrib['cx'] = str(cx * scale)

        if 'cy' in circle.attrib:
            cy = float(circle.attrib['cy'])
            circle.attrib['cy'] = str(cy * scale)

        if 'r' in circle.attrib:
            r = float(circle.attrib['r'])
            circle.attrib['r'] = str(r * scale)


def inline_styles(root):
    # Check if <defs> exists
    defs_tag = root.find('.//{http://www.w3.org/2000/svg}defs')
    if defs_tag is None:
        print('No <defs> tag found in the SVG file.')
        return

    # Create a dictionary to store CSS properties
    css_properties = defaultdict(list)

    # Find and process the <style> tag within <defs>
    style_tag = defs_tag.find('{http://www.w3.org/2000/svg}style')
    if style_tag is not None:
        css_text = style_tag.text.strip()  # Get the CSS text inside the <style> tag

        # Split the CSS text into individual rules
        css_rules = css_text.split('}')
        for rule in css_rules:
            rule = rule.strip()
            if not rule:
                continue

            # Split each rule into selector and properties
            selectors, properties = rule.split('{', 1)
            selectors = [s.strip() for s in selectors.split(',')]
            properties = properties.strip()

            # Store the CSS properties in the dictionary
            for property in properties.split(';'):
                property = property.strip()
                if property:
                    for selector in selectors:
                        css_properties[selector].append(property)

        # Remove the <defs> and <style> tags
        defs_tag.remove(style_tag)
        root.remove(defs_tag)

    # Apply CSS properties to matching elements throughout the document
    for element in root.iter():
        if 'class' in element.attrib:
            selectors = [f'.{s.strip()}' for s in element.attrib['class'].strip().split(' ')]
            for selector in selectors:
                if selector in css_properties:
                    properties = css_properties[selector]
                    for prop in properties:
                        prop = prop.strip()
                        if prop:
                            prop_name, prop_value = prop.split(':', 1)
                            element.set(prop_name.strip(), prop_value.strip())
    
           # Delete the 'class' attribute from the element
            del element.attrib['class']


def fix_svg_file(input_file, output_file, scale=None):
    # Parse the SVG file
    tree = ET.parse(input_file)
    root = tree.getroot()

    inline_styles(root)

    # Iterate through all <path> elements
    for path in root.iter('{http://www.w3.org/2000/svg}path'):
        if 'd' in path.attrib:
            # Get the command string value
            command_string = path.attrib['d']

            # Clean the command string
            cleaned_command_string = clean_command_string(command_string, scale, scale)

            # Update the 'd' attribute with the cleaned value
            path.set('d', cleaned_command_string)
    
    # Scale all circles
    scale_circles(root, scale)

    # Add necessary XML namespaces and attributes to the root <svg> element
    root.attrib['xmlns'] = 'http://www.w3.org/2000/svg'
    root.attrib['xmlns:xlink'] = 'http://www.w3.org/1999/xlink'
    root.attrib['version'] = '1.1'

    # Remove the namespace prefixes
    for elem in root.iter():
        if '}' in elem.tag:
            elem.tag = elem.tag.split('}', 1)[1]

    # Save the modified SVG
    tree.write(output_file, encoding='utf-8', xml_declaration=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Fix SVG file by inlining styles and re-formatting path strings.')
    parser.add_argument('input_file', help='Relative path to the input SVG file.')
    parser.add_argument('--output', default='output.svg', help='Relative path to the output SVG file (default: output.svg).')
    parser.add_argument('--scale', type=float, default=1.0, help='How much to scale the SVG elements by (default: 1.0).')

    args = parser.parse_args()
    input_svg_path = args.input_file
    output_svg_path = args.output
    scale = args.scale

    fix_svg_file(input_svg_path, output_svg_path, scale)

