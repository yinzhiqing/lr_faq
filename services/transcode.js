const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Check if a video file uses HEVC/H.265 codec
 */
function isHevc(filePath) {
  try {
    const out = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { timeout: 10000, encoding: 'utf8' }
    );
    return out.trim() === 'hevc';
  } catch {
    return false;
  }
}

/**
 * Transcode HEVC video to H.264 using ffmpeg.
 * Returns the path to the transcoded file, or null on failure.
 * The original .mp4 will be replaced by the H.264 version.
 */
function transcodeToH264(filePath) {
  const tmpPath = filePath + '.transcoded.mp4';
  try {
    execSync(
      `ffmpeg -i "${filePath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -movflags +faststart -y "${tmpPath}"`,
      { timeout: 300000, encoding: 'utf8', stdio: 'pipe' }
    );
    // Replace original with transcoded version
    fs.unlinkSync(filePath);
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (e) {
    // Clean up temp file on failure
    try { fs.unlinkSync(tmpPath); } catch {}
    console.error('Video transcode failed:', e.message);
    return false;
  }
}

/**
 * Process uploaded video file: transcode HEVC to H.264 if needed.
 * Returns new file size (or original size if no change).
 */
function processVideo(filePath) {
  if (!isHevc(filePath)) {
    return fs.statSync(filePath).size;
  }
  console.log('Detected HEVC video, transcoding to H.264...');
  const success = transcodeToH264(filePath);
  if (success) {
    console.log('Transcode complete');
    return fs.statSync(filePath).size;
  }
  // Return original size on failure (file stays as-is)
  return fs.statSync(filePath).size;
}

module.exports = { processVideo, isHevc };
