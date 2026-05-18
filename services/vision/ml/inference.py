import torch
import torch.nn as nn
import torchvision.transforms as transforms
from PIL import Image
import cv2
import numpy as np
import os

# Define the exact same architecture as training
class AlphabetCNN(nn.Module):
    def __init__(self):
        super(AlphabetCNN, self).__init__()
        self.conv1 = nn.Conv2d(1, 32, kernel_size=3, padding=1)
        self.relu1 = nn.ReLU()
        self.pool1 = nn.MaxPool2d(kernel_size=2, stride=2)
        
        self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.relu2 = nn.ReLU()
        self.pool2 = nn.MaxPool2d(kernel_size=2, stride=2)
        
        self.fc1 = nn.Linear(64 * 7 * 7, 128)
        self.relu3 = nn.ReLU()
        self.fc2 = nn.Linear(128, 26)
        
    def forward(self, x):
        x = self.pool1(self.relu1(self.conv1(x)))
        x = self.pool2(self.relu2(self.conv2(x)))
        x = x.view(-1, 64 * 7 * 7)
        x = self.relu3(self.fc1(x))
        x = self.fc2(x)
        return x

_model = None
_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_transform = transforms.Compose([
    transforms.Resize((28, 28)),
    transforms.ToTensor(),
    transforms.Normalize((0.5,), (0.5,))
])

def load_local_model():
    global _model
    if _model is None:
        model_path = os.path.join(os.path.dirname(__file__), '../models/alphabet_cnn.pth')
        _model = AlphabetCNN()
        if os.path.exists(model_path):
            _model.load_state_dict(torch.load(model_path, map_location=_device))
            _model.eval()
            _model.to(_device)
            print("[ML] Loaded local custom CNN model successfully.")
        else:
            print("[ML] WARNING: alphabet_cnn.pth not found! Using untrained model.")

def predict_letter(image: np.ndarray) -> str:
    """Predicts A-Z letter from a cropped BGR image using the custom local CNN."""
    load_local_model()
    
    # Preprocess image to look like EMNIST (Black background, white stroke)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Otsu thresholding to isolate handwriting
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    # Apply border clearing to remove the blue answer box boundaries
    h_t, w_t = thresh.shape
    mask = np.zeros((h_t + 2, w_t + 2), np.uint8)
    
    # Flood fill with black (0) from any white pixels on all 4 margins
    for x in range(w_t):
        if thresh[0, x] == 255:
            cv2.floodFill(thresh, mask, (x, 0), 0)
        if thresh[h_t - 1, x] == 255:
            cv2.floodFill(thresh, mask, (x, h_t - 1), 0)
            
    for y in range(h_t):
        if thresh[y, 0] == 255:
            cv2.floodFill(thresh, mask, (0, y), 0)
        if thresh[y, w_t - 1] == 255:
            cv2.floodFill(thresh, mask, (w_t - 1, y), 0)
            
    # Filter out small noise components (isolated dots, scanner noise, etc.)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(thresh, connectivity=8)
    for i in range(1, num_labels):
        if stats[i, cv2.CC_STAT_AREA] < 80:
            thresh[labels == i] = 0
            
    # EMNIST digits are centered, so let's find bounding box of white pixels and crop/pad
    coords = cv2.findNonZero(thresh)
    if coords is not None:
        x, y, w_c, h_c = cv2.boundingRect(coords)
        # Add a little padding
        padding = 10
        x = max(0, x - padding)
        y = max(0, y - padding)
        w_c = min(w_t - x, w_c + 2*padding)
        h_c = min(h_t - y, h_c + 2*padding)
        thresh = thresh[y:y+h_c, x:x+w_c]
    
    # Convert back to PIL Image for torchvision transform
    pil_img = Image.fromarray(thresh)
    
    img_tensor = _transform(pil_img).unsqueeze(0).to(_device)
    
    with torch.no_grad():
        outputs = _model(img_tensor)
        _, predicted = torch.max(outputs.data, 1)
        
    # EMNIST targets are 0-25 representing A-Z
    predicted_idx = predicted.item()
    predicted_letter = chr(predicted_idx + ord('A'))
    
    # Compute basic softmax confidence
    probs = torch.nn.functional.softmax(outputs, dim=1)
    confidence = probs[0][predicted_idx].item()
    
    return predicted_letter, confidence
