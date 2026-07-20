import sys
import os
import json
import re

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# pyrefly: ignore [missing-import]
import cv2
import numpy as np
# pyrefly: ignore [missing-import]
from rapidocr import RapidOCR


def preprocess_image(image_path):
    """
    Multi-strategy OpenCV preprocessing producing 3 image variants for multi-pass OCR:
      - Pass 1: Grayscale + CLAHE + Bilateral + Sharpen + Deskew  (general card)
      - Pass 2: Local Adaptive Threshold (noisy/textured backgrounds)
      - Pass 3: Binary/Inverted OTSU (light text on dark cards)
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image at path: {image_path}")

    height, width = img.shape[:2]
    max_dim = 1800
    if max(height, width) > max_dim:
        scale = max_dim / max(height, width)
        img = cv2.resize(img, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.bilateralFilter(gray, 9, 75, 75)

    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    contrast = clahe.apply(blurred)

    gaussian = cv2.GaussianBlur(contrast, (0, 0), 3)
    sharpened = cv2.addWeighted(contrast, 1.5, gaussian, -0.5, 0)

    angle = _detect_skew_angle(sharpened)
    if abs(angle) > 0.5:
        (h, w) = sharpened.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        sharpened = cv2.warpAffine(sharpened, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        img = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

    adaptive = cv2.adaptiveThreshold(
        sharpened, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=21, C=10
    )

    _, otsu = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if np.mean(sharpened) > 127:
        pass3 = otsu
    else:
        pass3 = cv2.bitwise_not(otsu)

    return img, sharpened, adaptive, pass3


def _detect_skew_angle(gray_img):
    """Detect rotation skew angle via Hough Lines with minAreaRect fallback."""
    angle = 0.0
    edges = cv2.Canny(gray_img, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 100, minLineLength=100, maxLineGap=10)

    if lines is not None and len(lines) > 0:
        angles = []
        for line in lines:
            coords = line[0] if (len(line.shape) == 2 and line.shape[0] == 1) else line
            x1, y1, x2, y2 = coords
            angle_rad = np.arctan2(y2 - y1, x2 - x1)
            angle_deg = angle_rad * 180 / np.pi
            if -45 < angle_deg < 45:
                angles.append(angle_deg)
        if angles:
            angle = float(np.median(angles))

    if abs(angle) < 0.5:
        _, thresh = cv2.threshold(gray_img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        coords = np.column_stack(np.where(thresh > 0))
        if len(coords) > 0:
            rect_angle = cv2.minAreaRect(coords)[-1]
            if rect_angle < -45:
                rect_angle = -(90 + rect_angle)
            else:
                rect_angle = -rect_angle
            if 0.5 < abs(rect_angle) < 45:
                angle = rect_angle

    return angle


def detect_qr_codes(img):
    """Detect and decode QR Codes from the color image."""
    detector = cv2.QRCodeDetector()
    retval, decoded_info, points, _ = detector.detectAndDecodeMulti(img)
    qr_data = []
    if retval:
        for info in decoded_info:
            if info.strip():
                qr_data.append(info.strip())
    return len(qr_data) > 0, qr_data


def run_ocr_on_image(engine, image):
    """Run RapidOCR on a single image variant and return list of (text, confidence) tuples."""
    results = []
    ocr_out = engine(image)
    if ocr_out is None:
        return results

    raw = []
    if hasattr(ocr_out, 'txts') and ocr_out.txts is not None:
        txts = ocr_out.txts
        scores = ocr_out.scores if hasattr(ocr_out, 'scores') and ocr_out.scores is not None else [1.0] * len(txts)
        raw = list(zip(txts, scores))
    elif isinstance(ocr_out, tuple):
        raw_results = ocr_out[0] or []
        for r in raw_results:
            if isinstance(r, (list, tuple)) and len(r) >= 2:
                text = r[1]
                score = r[2] if len(r) > 2 else 1.0
                if text and text.strip():
                    raw.append((text.strip(), float(score) if score else 0.0))
            elif isinstance(r, str) and r.strip():
                raw.append((r.strip(), 1.0))
    else:
        if isinstance(ocr_out, (list, tuple)):
            for r in ocr_out:
                text = r[1] if (isinstance(r, (list, tuple)) and len(r) >= 2) else r
                if text and text.strip():
                    raw.append((text.strip(), 1.0))

    for text, score in raw:
        if text and text.strip():
            results.append((text.strip(), float(score) if score else 1.0))

    return results


def merge_ocr_results(results_list):
    """
    Union text lines from multiple OCR passes.
    Preserves Pass 1 ordering (best quality). Passes 2 & 3 only add lines
    not already captured, placed at the end.
    Deduplicates using lowercased normalized comparison.
    """
    # Build the canonical text set from Pass 1 first (preserving original order)
    seen_lower = {}
    ordered = []
    for text, score in results_list[0]:
        key = re.sub(r'\s+', ' ', text.lower().strip())
        if len(key) < 2:
            continue
        if key not in seen_lower:
            seen_lower[key] = score
            ordered.append((text, score))

    # Append unique lines from subsequent passes
    for results in results_list[1:]:
        for text, score in results:
            key = re.sub(r'\s+', ' ', text.lower().strip())
            if len(key) < 2:
                continue
            if key not in seen_lower:
                seen_lower[key] = score
                ordered.append((text, score))
    return ordered


def parse_contact_fields(text_lines):
    """
    Intelligent heuristic-based extraction of contact fields from OCR text lines.
    Multi-priority matching to minimize misclassification.
    """
    full_text = "\n".join(text_lines)

    email_pattern = r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}'
    phone_pattern = r'(?:(?:\+|00)\d{1,4}[\s\-.]?)?\(?\d{2,4}\)?[\s\-.]?\d{2,5}[\s\-.]?\d{2,5}(?:[\s\-.]?\d{1,5})?'
    website_pattern = r'(?:https?://)?(?:www\.)?[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}(?:/[^\s]*)?'
    linkedin_pattern = r'(?:https?://)?(?:www\.)?linkedin\.com/(?:in|company)/[a-zA-Z0-9_\-]+'

    emails = list(set(re.findall(email_pattern, full_text)))
    all_phones_raw = re.findall(phone_pattern, full_text)
    linkedin_matches = re.findall(linkedin_pattern, full_text)
    all_urls = re.findall(website_pattern, full_text)

    phones = []
    seen_digits = set()
    for p in all_phones_raw:
        digits = re.sub(r'\D', '', p)
        if 7 <= len(digits) <= 15 and digits not in seen_digits:
            phones.append(p.strip())
            seen_digits.add(digits)

    linkedin_url = linkedin_matches[0] if linkedin_matches else None
    websites = []
    for url in all_urls:
        if "linkedin.com" in url:
            continue
        if "@" in url:
            continue
        if any(url.lower() == email.split('@')[-1].lower() for email in emails):
            continue
        # Skip URLs that look like email username portions (e.g. "vishal.wamanker")
        if emails and any(email.split('@')[0].lower() in url.lower() for email in emails):
            continue
        if len(url) < 5:
            continue
        # Must contain a real TLD (at least 2 alpha chars after dot)
        if not re.search(r'\.[a-zA-Z]{2,}', url):
            continue
        websites.append(url)
    websites = list(dict.fromkeys(websites))

    email = emails[0] if emails else None
    phone = phones[0] if phones else None

    website = None
    if email:
        # Primary strategy: derive website from email domain (most reliable)
        email_domain = email.split('@')[-1].lower()
        email_domain_stem = email_domain.split('.')[0]  # e.g. "infosys"
        # Check if any detected website explicitly matches the email domain
        confirmed_from_ocr = None
        for w in websites:
            w_host = w.lower().replace('www.', '').split('/')[0]
            if email_domain in w_host or email_domain_stem in w_host:
                confirmed_from_ocr = w
                break
        # Prefer OCR-confirmed URL (e.g. picks up 'https://infosys.com/...' if present)
        # otherwise fall back to the email domain
        website = confirmed_from_ocr if confirmed_from_ocr else f"www.{email_domain}"
    elif websites:
        # No email available: pick a credible-looking detected website
        trusted_tlds = {
            'com', 'net', 'org', 'io', 'co', 'gov', 'edu', 'in', 'uk', 'de',
            'au', 'ca', 'sg', 'jp', 'fr', 'br', 'cn', 'us', 'info', 'biz', 'tech'
        }
        for w in websites:
            parts = w.lower().replace('www.', '').split('.')
            if len(parts) >= 2 and parts[-1] in trusted_tlds and len(parts[0]) >= 3:
                website = w
                break


    email_domain_word = ""
    if email:
        domain_parts = email.split('@')[-1].split('.')
        if len(domain_parts) >= 2:
            email_domain_word = domain_parts[-2].lower()

    strong_company_suffixes = ['ltd', 'limited', 'inc', 'corp', 'corporation', 'llc', 'llp', 'plc', 'pvt']
    soft_company_keywords = [
        'company', 'group', 'ventures', 'technologies', 'solutions', 'systems',
        'consulting', 'developers', 'labs', 'studios', 'creative', 'agency',
        'firm', 'enterprises', 'industries', 'services', 'partners', 'associates',
        'capital', 'global', 'networks', 'digital', 'media', 'international'
    ]
    all_company_keywords = strong_company_suffixes + soft_company_keywords

    designation_keywords = [
        'director', 'manager', 'engineer', 'lead', 'president', 'founder',
        'ceo', 'cto', 'coo', 'cfo', 'vp', 'vice president', 'svp', 'evp',
        'architect', 'analyst', 'specialist', 'partner', 'consultant', 'associate',
        'advisor', 'head', 'officer', 'executive', 'principal', 'coordinator',
        'administrator', 'supervisor', 'developer', 'designer', 'scientist',
        'researcher', 'intern', 'trainee', 'account', 'sales', 'marketing'
    ]

    address_keywords = [
        'street', 'st', 'avenue', 'ave', 'road', 'rd', 'way', 'boulevard', 'blvd',
        'lane', 'ln', 'drive', 'dr', 'suite', 'ste', 'floor', 'fl',
        'plaza', 'building', 'bldg', 'block', 'sector', 'phase', 'nagar',
        'colony', 'layout', 'extension', 'cross', 'main',
        'india', 'taiwan', 'china', 'usa', 'uk', 'singapore', 'japan',
        'korea', 'malaysia', 'indonesia', 'thailand', 'vietnam',
        'ny', 'ca', 'tx', 'wa', 'fl', 'il', 'oh', 'ma', 'ga',
    ]

    remaining_lines = []
    address_lines = []
    for line in text_lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        line_lower = line_clean.lower()
        if (any(re.search(r'\b' + re.escape(kw) + r'\b', line_lower) for kw in address_keywords)
                or re.search(r'\b\d{5}(?:-\d{4})?\b', line_clean)
                or re.search(r'\b\d{6}\b', line_clean)
                or re.search(r'\bno\.\s*\d+', line_lower)):
            address_lines.append(line_clean)
        else:
            remaining_lines.append(line_clean)

    filtered_lines = []
    for line in remaining_lines:
        line_lower = line.lower()
        if email and email.lower() in line_lower:
            continue
        if phone and any(re.sub(r'\D', '', p) in re.sub(r'\D', '', line) and len(re.sub(r'\D', '', p)) >= 7 for p in phones):
            continue
        if websites and any(w.lower() in line_lower for w in websites if len(w) >= 6):
            continue
        if linkedin_url and "linkedin.com" in line_lower:
            continue
        filtered_lines.append(line)

    company = None

    for line in filtered_lines:
        if any(re.search(r'\b' + re.escape(kw) + r'\b', line.lower()) for kw in strong_company_suffixes):
            company = line
            break

    if not company and email_domain_word and len(email_domain_word) > 3:
        for line in filtered_lines:
            if email_domain_word in line.lower():
                company = line
                break

    if not company:
        for line in filtered_lines:
            if any(re.search(r'\b' + re.escape(kw) + r'\b', line.lower()) for kw in soft_company_keywords):
                company = line
                break

    designation = None
    for line in filtered_lines:
        if line == company:
            continue
        if any(re.search(r'\b' + re.escape(kw) + r'\b', line.lower()) for kw in designation_keywords):
            designation = line
            break

    name = None
    # Common slogan/tagline words that should never be treated as person names
    tagline_words = {
        'navigate', 'your', 'next', 'discover', 'inspire', 'innovate', 'transform',
        'excellence', 'beyond', 'tomorrow', 'future', 'vision', 'mission', 'success',
        'solution', 'moving', 'forward', 'together', 'world', 'better', 'leading',
        'powered', 'driven', 'committed', 'dedicated', 'trusted', 'building', 'shaping',
        'connecting', 'enabling', 'empowering', 'creating', 'delivering', 'making',
        'think', 'beyond', 'the', 'possible', 'impossible', 'everything', 'nothing',
        'welcome', 'hello', 'greetings', 'simply', 'smart', 'faster', 'better', 'stronger',
    }
    for line in filtered_lines:
        if line == company or line == designation:
            continue
        if any(char.isdigit() for char in line):
            continue
        if any(re.search(r'\b' + re.escape(kw) + r'\b', line.lower()) for kw in all_company_keywords + designation_keywords):
            continue
        words = line.split()
        # Skip if most words are tagline/slogan words
        if sum(1 for w in words if w.lower() in tagline_words) > len(words) // 2:
            continue
        if 2 <= len(words) <= 4 and all(re.match(r'^[a-zA-Z\.\-\u00C0-\u017F]+$', w) for w in words):
            name = line
            break

    if not name:
        for line in filtered_lines:
            if line == company or line == designation:
                continue
            if re.match(r'^[a-zA-Z\s\.\-\u00C0-\u017F]+$', line) and 3 <= len(line) <= 40:
                name = line
                break

    if not name and text_lines:
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
        color_img, pass1_img, pass2_img, pass3_img = preprocess_image(image_path)
        qr_present, qr_data = detect_qr_codes(color_img)

        engine = RapidOCR()
        results_pass1 = run_ocr_on_image(engine, pass1_img)
        results_pass2 = run_ocr_on_image(engine, pass2_img)
        results_pass3 = run_ocr_on_image(engine, pass3_img)

        merged_results = merge_ocr_results([results_pass1, results_pass2, results_pass3])
        text_lines = [text for text, _ in merged_results]

        deduped_lines = []
        seen_lower = set()
        for line in text_lines:
            key = re.sub(r'\s+', ' ', line.lower().strip())
            if key not in seen_lower:
                deduped_lines.append(line)
                seen_lower.add(key)

        structured = parse_contact_fields(deduped_lines)

        output = {
            "success": True,
            "ocr_text": "\n".join(deduped_lines),
            "qr_present": qr_present,
            "qr_data": qr_data,
            "structured": structured
        }
        print(json.dumps(output, ensure_ascii=False), flush=True)

    except Exception as e:
        import traceback
        print(json.dumps({"success": False, "message": str(e), "trace": traceback.format_exc()}), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
