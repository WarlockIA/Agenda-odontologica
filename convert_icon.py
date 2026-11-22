from PIL import Image
import os

img = Image.open('build/icon.png')
img.save('build/icon.ico', format='ICO', sizes=[(256, 256)])
print("Icon converted successfully to build/icon.ico")
