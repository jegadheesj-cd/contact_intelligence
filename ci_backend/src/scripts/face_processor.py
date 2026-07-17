import sys
import os
import json
# pyrefly: ignore [missing-import]
import cv2
import numpy as np
# pyrefly: ignore [missing-import]
from insightface.app import FaceAnalysis

def get_face_analyzer():
    # Use buffalo_s (small model) to run quickly on CPU
    app = FaceAnalysis(name='buffalo_s', root='~/.insightface', allowed_modules=['detection', 'recognition'])
    # ctx_id=-1 enforces CPU execution
    app.prepare(ctx_id=-1, det_size=(640, 640))
    return app

def extract_embedding_from_image(image_path, app=None):
    if app is None:
        app = get_face_analyzer()
        
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image: {image_path}")
        
    faces = app.get(img)
    if not faces:
        return None
        
    # Sort faces by size (bounding box area) and choose the largest face
    faces = sorted(faces, key=lambda x: (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]), reverse=True)
    face = faces[0]
    
    # Bounding box coordinates
    bbox = [int(x) for x in face.bbox]
    
    return {
        "embedding": face.embedding.tolist(),
        "bbox": {
            "left": bbox[0],
            "top": bbox[1],
            "width": bbox[2] - bbox[0],
            "height": bbox[3] - bbox[1]
        },
        "det_score": float(face.det_score)
    }

def extract_embedding_from_video(video_path):
    app = get_face_analyzer()
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video file: {video_path}")
        
    best_face = None
    frame_count = 0
    sample_rate = 5 # check every 5th frame to speed up
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        if frame_count % sample_rate == 0:
            # Detect face
            faces = app.get(frame)
            if faces:
                # Find largest/best face in current frame
                faces = sorted(faces, key=lambda x: (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]), reverse=True)
                face = faces[0]
                
                # Keep the face with highest detection score
                if best_face is None or face.det_score > best_face["det_score"]:
                    bbox = [int(x) for x in face.bbox]
                    best_face = {
                        "embedding": face.embedding.tolist(),
                        "bbox": {
                            "left": bbox[0],
                            "top": bbox[1],
                            "width": bbox[2] - bbox[0],
                            "height": bbox[3] - bbox[1]
                        },
                        "det_score": float(face.det_score)
                    }
        frame_count += 1
        
    cap.release()
    return best_face

def compute_similarity(emb1, emb2):
    emb1 = np.array(emb1)
    emb2 = np.array(emb2)
    dot_prod = np.dot(emb1, emb2)
    norm1 = np.linalg.norm(emb1)
    norm2 = np.linalg.norm(emb2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot_prod / (norm1 * norm2))

def match_face(media_path, enrolled_profiles_path, is_video=False):
    # 1. Extract embedding from input media
    if is_video:
        target = extract_embedding_from_video(media_path)
    else:
        target = extract_embedding_from_image(media_path)
        
    if not target:
        return {"success": True, "matched": False, "message": "No face detected in uploaded media."}
        
    target_emb = target["embedding"]
    
    # 2. Load enrolled profiles
    if not os.path.exists(enrolled_profiles_path):
        return {"success": True, "matched": False, "message": "No enrolled faces found."}
        
    with open(enrolled_profiles_path, 'r') as f:
        enrolled = json.load(f)
        
    best_match = None
    highest_score = -1.0
    threshold = 0.60 # Standard threshold for InsightFace cosine similarity
    
    for profile in enrolled.get("profiles", []):
        db_emb = profile.get("embedding")
        if not db_emb:
            continue
            
        score = compute_similarity(target_emb, db_emb)
        if score > highest_score:
            highest_score = score
            best_match = profile
            
    if best_match and highest_score >= threshold:
        return {
            "success": True,
            "matched": True,
            "contactId": best_match["contactId"],
            "similarityScore": highest_score,
            "boundingBox": target["bbox"],
            "det_score": target["det_score"]
        }
    else:
        return {
            "success": True,
            "matched": False,
            "similarityScore": highest_score if best_match else 0.0,
            "message": "Face detected, but no matching enrolled contact was found in the database."
        }

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "message": "Usage: python face_processor.py [detect|match] <media_path> [enrolled_json_path] [is_video]"}), flush=True)
        sys.exit(1)
        
    action = sys.argv[1]
    media_path = sys.argv[2]
    
    if not os.path.exists(media_path):
        print(json.dumps({"success": False, "message": f"File does not exist: {media_path}"}), flush=True)
        sys.exit(1)
        
    try:
        if action == "detect":
            is_video = len(sys.argv) > 3 and sys.argv[3] == "true"
            if is_video:
                result = extract_embedding_from_video(media_path)
            else:
                result = extract_embedding_from_image(media_path)
                
            if result:
                print(json.dumps({"success": True, "face_detected": True, **result}), flush=True)
            else:
                print(json.dumps({"success": True, "face_detected": False, "message": "No face detected"}), flush=True)
                
        elif action == "match":
            if len(sys.argv) < 4:
                print(json.dumps({"success": False, "message": "enrolled_json_path is required for matching"}), flush=True)
                sys.exit(1)
            enrolled_path = sys.argv[3]
            is_video = len(sys.argv) > 4 and sys.argv[4] == "true"
            
            result = match_face(media_path, enrolled_path, is_video=is_video)
            print(json.dumps(result), flush=True)
            
        else:
            print(json.dumps({"success": False, "message": f"Unknown action: {action}"}), flush=True)
            sys.exit(1)
            
    except Exception as e:
        print(json.dumps({"success": False, "message": str(e)}), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
