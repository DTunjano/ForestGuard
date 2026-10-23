import numpy as np
from rasterio.io import MemoryFile
from rasterio.transform import from_origin

from catalog.serializers import contains_valid_pixel


def test_valid_pixel_scan_reaches_later_window_and_applies_scl():
    descriptions = ["B2", "B3", "B4", "B5", "B8", "B11", "B12", "SCL"]
    data = np.full((8, 514, 514), np.nan, dtype="float32")
    data[:7, 513, 513] = 0.4
    data[7, 513, 513] = 4
    with MemoryFile() as memory:
        with memory.open(driver="GTiff", width=514, height=514, count=8, dtype="float32",
                         crs="EPSG:32618", transform=from_origin(500000, 500000, 10, 10)) as output:
            output.write(data)
        with memory.open() as source:
            assert contains_valid_pixel(source, descriptions, "fraction", 1)
            assert not contains_valid_pixel(source, descriptions, "divide_10000", 10000)
