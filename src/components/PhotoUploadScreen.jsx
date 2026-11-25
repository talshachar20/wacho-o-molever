import { useRef, useState } from 'react';
import { composeExpressionVariants } from '../utils/faceCompositor';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB — generous for a phone photo

export default function PhotoUploadScreen({ onPhotoReady }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [variants, setVariants] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'processing' | 'ready' | 'error'
  const [error, setError] = useState(null);
  // Set when the landmark model couldn't find a face — the photo still
  // works, it just won't have distinct happy/sad/angry looks this round.
  const [noFaceDetected, setNoFaceDetected] = useState(false);
  const fileInputRef = useRef(null);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatus('error');
      setError('That is not an image file. Try a JPG or PNG.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setStatus('error');
      setError('That image is too large (max 10MB). Try a smaller photo.');
      return;
    }

    setStatus('processing');
    setError(null);
    setNoFaceDetected(false);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const { variants: expressionVariants, facesDetected } = await composeExpressionVariants(file);
      setVariants(expressionVariants);
      setNoFaceDetected(!facesDetected);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Something went wrong processing that photo.');
    }
  }

  function handleContinue() {
    if (status === 'ready' && variants) {
      onPhotoReady(variants);
    }
  }

  function handlePickAnother() {
    setStatus('idle');
    setVariants(null);
    setPreviewUrl(null);
    setError(null);
    setNoFaceDetected(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="screen upload-screen">
      <h1>Whac-O-Molever</h1>
      <p className="subtitle">
        Upload a photo — ideally a face — and it'll pop out of the holes
        instead of a mole. Smiling, sad, and angry variants are generated
        automatically.
      </p>

      <div className="upload-box">
        {previewUrl ? (
          <img src={previewUrl} alt="Your upload preview" className="upload-preview" />
        ) : (
          <div className="upload-placeholder">No photo chosen yet</div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="file-input"
        aria-label="Upload a photo"
      />

      {status === 'processing' && <p className="status-line">Detecting your face and warping expressions…</p>}
      {status === 'error' && <p className="status-line error">{error}</p>}
      {status === 'ready' && !noFaceDetected && (
        <p className="status-line success">Photo ready. Three moods generated from your actual face.</p>
      )}
      {status === 'ready' && noFaceDetected && (
        <p className="status-line warning">
          Couldn't detect a face in that photo — expressions will be static this round. You can still play.
        </p>
      )}

      <div className="button-row">
        <button type="button" onClick={handlePickAnother} disabled={status === 'idle'} className="secondary">
          Choose a different photo
        </button>
        <button type="button" onClick={handleContinue} disabled={status !== 'ready'} className="primary">
          Continue
        </button>
      </div>
    </div>
  );
}
