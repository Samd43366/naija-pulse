"""
Privacy, Anonymization, and Metadata Stripping for Naija Pulse.

Directly implements Feature 5:
- Stripping EXIF metadata (GPS coords, device model) from uploaded images.
- Obfuscating exact coordinates for sensitive categories (kidnapping, violent crime)
  by snapping to the H3 hexagon centroid.
"""

import io
from typing import Tuple
from PIL import Image
from app.core.h3_utils import latlng_to_h3, h3_to_latlng


def strip_image_exif(image_bytes: bytes) -> bytes:
    """
    Strips all EXIF metadata (including GPS tags, camera details, timestamps)
    from an image to protect citizen safety.
    
    Re-encodes the clean pixel data into a standard JPEG/PNG buffer.
    """
    image = Image.open(io.BytesIO(image_bytes))
    
    # Create a fresh image with same mode & size, copying pixel data without EXIF
    clean_image = Image.new(image.mode, image.size)
    clean_image.putdata(list(image.getdata()))
    
    output_buffer = io.BytesIO()
    # Save back without exif dictionary
    format_to_use = image.format if image.format in ("JPEG", "PNG") else "JPEG"
    clean_image.save(output_buffer, format=format_to_use, quality=85)
    return output_buffer.getvalue()


def get_public_location(
    lat: float,
    lng: float,
    is_sensitive: bool,
    h3_obfuscation_res: int = 7
) -> Tuple[float, float]:
    """
    For non-sensitive events (flood, power outage, road hazards), returns the true coordinate.
    For sensitive events (kidnapping, armed attacks), snaps the coordinate to the
    centroid of its enclosing H3 hexagon (e.g. Res 7 ~1.2km edge), obscuring the exact street.
    """
    if not is_sensitive:
        return (lat, lng)
    
    # Snap to macro H3 centroid
    macro_hex = latlng_to_h3(lat, lng, resolution=h3_obfuscation_res)
    blurred_lat, blurred_lng = h3_to_latlng(macro_hex)
    return (blurred_lat, blurred_lng)
