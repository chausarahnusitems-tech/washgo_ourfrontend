"use client";

import { useRef, useState } from "react";
import { ImagePlus, Video, X } from "lucide-react";
import { useApp } from "../../lib/AppContext.jsx";
import { Button } from "../ui/Button.jsx";

// Owner editor for a single service's details: description + optional photo +
// optional short video. Works for both catalogue and custom services. Seeds from
// `initial` = { description, imageUrl, videoUrl }. On save, calls
// onSave({ description, imageFile, videoFile, removeImage, removeVideo }); the
// parent uploads media (the bucket differs per service kind) and persists.
const IMAGE_MAX_BYTES = 25 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const VIDEO_MAX_SECONDS = 30;

function readDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration || 0);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    v.src = url;
  });
}

export function ServiceDetailsModal({ title, initial = {}, busy = false, onSave, onCancel }) {
  const { t } = useApp();
  const [description, setDescription] = useState(initial.description ?? "");
  const [imageFile, setImageFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(initial.imageUrl ?? null);
  const [videoPreview, setVideoPreview] = useState(initial.videoUrl ?? null);
  const [error, setError] = useState(null);
  const imgRef = useRef(null);
  const vidRef = useRef(null);

  const onPickImage = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > IMAGE_MAX_BYTES) {
      setError(t("imageTooLarge"));
      return;
    }
    setError(null);
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const onPickVideo = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > VIDEO_MAX_BYTES) {
      setError(t("videoTooLarge"));
      return;
    }
    const dur = await readDuration(f);
    if (dur > VIDEO_MAX_SECONDS + 0.5) {
      setError(t("serviceVideoTooLong"));
      return;
    }
    setError(null);
    setVideoFile(f);
    setVideoPreview(URL.createObjectURL(f));
  };

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-black">{title || t("serviceDetails")}</h3>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("close")}
          className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-bold text-neutral-500">{t("serviceDescription")}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder={t("serviceDescriptionPlaceholder")}
          className="mt-1 w-full resize-none rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-wash-500"
        />
      </label>

      <div className="mt-3">
        <span className="text-xs font-bold text-neutral-500">{t("servicePhoto")}</span>
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
        <div className="mt-1 flex items-center gap-3">
          {imagePreview ? (
            <img src={imagePreview} alt="" className="h-16 w-16 rounded-xl object-cover ring-1 ring-black/10" />
          ) : null}
          <button
            type="button"
            onClick={() => imgRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-200"
          >
            <ImagePlus className="h-3.5 w-3.5" /> {imagePreview ? t("changePhoto") : t("addPhoto")}
          </button>
          {imagePreview ? (
            <button
              type="button"
              onClick={() => {
                setImageFile(null);
                setImagePreview(null);
              }}
              className="text-xs font-semibold text-neutral-500 hover:underline"
            >
              {t("remove")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        <span className="text-xs font-bold text-neutral-500">{t("serviceVideo")}</span>
        <input ref={vidRef} type="file" accept="video/*" className="hidden" onChange={onPickVideo} />
        <div className="mt-1 flex items-center gap-3">
          {videoPreview ? (
            <video src={videoPreview} className="h-16 w-24 rounded-xl object-cover ring-1 ring-black/10" muted />
          ) : null}
          <button
            type="button"
            onClick={() => vidRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-200"
          >
            <Video className="h-3.5 w-3.5" /> {videoPreview ? t("changeVideo") : t("addVideo")}
          </button>
          {videoPreview ? (
            <button
              type="button"
              onClick={() => {
                setVideoFile(null);
                setVideoPreview(null);
              }}
              className="text-xs font-semibold text-neutral-500 hover:underline"
            >
              {t("remove")}
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-[0.7rem] text-neutral-400">{t("serviceVideoHint")}</p>
      </div>

      {error ? <p className="mt-2 text-xs font-bold text-red-600">{error}</p> : null}

      <div className="mt-4 flex gap-2">
        <Button
          onClick={() =>
            onSave({
              description: description.trim(),
              imageFile,
              videoFile,
              removeImage: !imagePreview && !imageFile,
              removeVideo: !videoPreview && !videoFile
            })
          }
          disabled={busy}
          className="min-h-11 flex-1"
        >
          {busy ? t("saving") : t("save")}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy} className="min-h-11">
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
