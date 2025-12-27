
from PIL import Image
import math

def color_dist(c1, c2):
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2)))

def remove_green(input_path, output_path):
    img = Image.open(input_path)
    img = img.convert("RGBA")
    datas = img.getdata()

    new_data = []
    # Target green
    target_color = (0, 255, 0)
    
    # Thresholds
    # Lower threshold: Pixels closer than this are fully transparent
    # Upper threshold: Pixels between lower and upper are semi-transparent (antialiased)
    threshold_lower = 80 
    threshold_upper = 150

    for item in datas:
        # Check distance from green
        # item is (r, g, b, a)
        color = item[:3]
        dist = color_dist(color, target_color)

        if dist < threshold_lower:
             # Fully transparent
            new_data.append((255, 255, 255, 0))
        elif dist < threshold_upper:
            # Semi-transparent edge (simple linear alpha)
            # dist=lower -> alpha=0
            # dist=upper -> alpha=255
            factor = (dist - threshold_lower) / (threshold_upper - threshold_lower)
            alpha = int(255 * factor)
            # Keep original color but fade it out
            new_data.append((item[0], item[1], item[2], alpha))
        else:
             # Keep original
            new_data.append(item)

    img.putdata(new_data)
    img.save(output_path, "PNG")

if __name__ == "__main__":
    remove_green("car_sprites_green.png", "public/car_sprites.png")
