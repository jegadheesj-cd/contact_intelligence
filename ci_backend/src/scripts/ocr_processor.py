import sys
import os
import json
import re
# pyrefly: ignore [missing-import]
import cv2
import numpy as np
# pyrefly: ignore [missing-import]
from rapidocr import RapidOCR

def preprocess_image(image_path):
    """
    Apply OpenCV preprocessing: resize, noise removal, contrast enhancement, rotation/deskew
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image at path: {image_path}")

    # Resize if image is very large to speed up processing while keeping quality
    height, width = img.shape[:2]
    max_dim = 1500
    if max(height, width) > max_dim:
        scale = max_dim / max(height, width)
        img = cv2.resize(img, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA)

    # Grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Noise removal (Gaussian blur)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)

    # Contrast enhancement (CLAHE - Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    contrast = clahe.apply(blurred)

    # Rotation/Deskew correction
    # Find all threshold pixels
    _, thresh = cv2.threshold(contrast, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    coords = np.column_stack(np.where(thresh > 0))
    
    # Calculate skew angle
    if len(coords) > 0:
        angle = cv2.minAreaRect(coords)[-1]
        # minAreaRect returns angle in range [-90, 0)
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
            
        # Rotate image if angle is significant
        if 0.5 < abs(angle) < 45:
            (h, w) = img.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            contrast = cv2.warpAffine(contrast, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
            img = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

    return img, contrast

def detect_qr_codes(img):
    """
    Detect and decode QR Codes from image
    """
    detector = cv2.QRCodeDetector()
    retval, decoded_info, points, _ = detector.detectAndDecodeMulti(img)
    
    qr_data = []
    if retval:
        for info in decoded_info:
            if info.strip():
                qr_data.append(info.strip())
                
    return len(qr_data) > 0, qr_data

def parse_contact_fields(text_lines):
    """
    Heuristic-based extraction of name, email, phone, website, company, designation, address
    """
    full_text = "\n".join(text_lines)
    
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    phone_pattern = r'(?:\+?\d{1,4}[-. \t]?)?\(?\d{2,4}\)?[-. \t]?\d{2,5}[-. \t]?\d{2,5}(?:[-. \t]?\d{2,5})?'
    website_pattern = r'(?:https?://)?(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:/[^\s]*)?'
    linkedin_pattern = r'(?:https?://)?(?:www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+'
    
    emails = re.findall(email_pattern, full_text)
    phones = re.findall(phone_pattern, full_text)
    
    # Filter unique values
    emails = list(set(emails))
    phones = list(set(phones))
    
    # Find websites excluding email domains and linkedin
    all_urls = re.findall(website_pattern, full_text)
    websites = []
    linkedin_url = None
    
    for url in all_urls:
        if "linkedin.com" in url:
            linkedin_url = url
        elif "@" not in url and not any(email.endswith(url) for email in emails):
            # clean url
            websites.append(url)
    
    websites = list(set(websites))
    
    # Clean lists
    email = emails[0] if emails else None
    phone = phones[0] if phones else None
    website = websites[0] if websites else None
    
    # Find Name and Designation
    # Typically, the name is the first line or one of the largest lines, not containing numbers, @, or key indicators
    name = None
    designation = None
    company = None
    address_lines = []
    
    company_keywords = [
        'ltd', 'limited', 'inc', 'corp', 'corporation', 'co', 'company', 'group', 'ventures',
        'technologies', 'solutions', 'systems', 'consulting', 'developers', 'labs', 'studios',
        'creative', 'agency', 'firm', 'enterprises', 'industries', 'services', 'partners',
        'associates', 'capital', 'global', 'networks', 'digital', 'media'
    ]
    designation_keywords = ['director', 'manager', 'engineer', 'lead', 'president', 'founder', 'ceo', 'cto', 'coo', 'vp', 'vice president', 'architect', 'analyst', 'specialist', 'partner', 'consultant']
    address_keywords = ['st', 'ave', 'road', 'rd', 'way', 'blvd', 'lane', 'ln', 'suite', 'ste', 'floor', 'fl', 'plaza', 'building', 'bldg', 'ny', 'ca', 'tx', 'wa', 'zip']
    
    for line in text_lines:
        line_clean = line.strip()
        if not line_clean:
            continue
            
        # Check address components
        if any(re.search(r'\b' + kw + r'\b', line_clean.lower()) for kw in address_keywords) or re.search(r'\b\d{5}(?:-\d{4})?\b', line_clean):
            address_lines.append(line_clean)
            continue
            
        # Skip lines that match email, phone, or website
        if email and email in line_clean:
            continue
        if phone and any(p in line_clean for p in phones):
            continue
        if website and website in line_clean:
            continue
        if linkedin_url and "linkedin.com" in line_clean:
            continue
            
        # Check company name
        if any(re.search(r'\b' + kw + r'\b', line_clean.lower()) for kw in company_keywords) and not company:
            company = line_clean
            continue
            
        # Check designation
        if any(re.search(r'\b' + kw + r'\b', line_clean.lower()) for kw in designation_keywords) and not designation:
            designation = line_clean
            continue
            
        # Fallback for name: first line that contains only alphabetical characters and spaces, length between 3 and 30
        if not name and re.match(r'^[a-zA-Z\s\.\-\u00C0-\u017F]+$', line_clean) and 3 <= len(line_clean) <= 30:
            name = line_clean
            
    # Fallbacks
    if not name and len(text_lines) > 0:
        name = text_lines[0]
        
    address = ", ".join(address_lines) if address_lines else None
    
    return {
        "name": name,
        "company": company,
        "designation": designation,
        "email": email,
        "phone": phone,
        "website": website,
        "address": address,
        "linkedin_url": linkedin_url,
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "message": "Usage: python ocr_processor.py <image_path>"}), flush=True)
        sys.exit(1)
        
    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(json.dumps({"success": False, "message": f"File does not exist: {image_path}"}), flush=True)
        sys.exit(1)
        
    try:
        # Preprocess
        color_img, preprocessed_img = preprocess_image(image_path)
        
        # QR Code Detection
        qr_present, qr_data = detect_qr_codes(color_img)
        
        # Run OCR
        engine = RapidOCR()
        ocr_out = engine(preprocessed_img)
        
        results = []
        if ocr_out is not None:
            if hasattr(ocr_out, 'txts'):
                # Newer RapidOCR returns RapidOCROutput object
                if ocr_out.txts is not None:
                    for txt in ocr_out.txts:
                        results.append([None, txt, None])
            elif isinstance(ocr_out, tuple):
                # Older RapidOCR returns (results, elapse)
                results = ocr_out[0] or []
            else:
                results = ocr_out

        text_lines = []
        for res in results:
            # res format is [box, text, score] (or res is just the text string in some fallbacks)
            text = res[1] if (isinstance(res, list) or isinstance(res, tuple)) else res
            if text and text.strip():
                text_lines.append(text.strip())
                    
        # Parse fields
        structured = parse_contact_fields(text_lines)
        
        # Format response
        output = {
            "success": True,
            "ocr_text": "\n".join(text_lines),
            "qr_present": qr_present,
            "qr_data": qr_data,
            "structured": structured
        }
        print(json.dumps(output, ensure_ascii=False), flush=True)
        
    except Exception as e:
        print(json.dumps({"success": False, "message": str(e)}), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
