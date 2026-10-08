

const TOTAL_PHOTOS = 4;       // jumlah foto dalam satu sesi
const PHOTO_WIDTH = 800;     // ukuran foto hasil jepretan (rasio 4:3)
const PHOTO_HEIGHT = 600;

// Daftar filter. Nilainya adalah teks "CSS filter".
// Dipakai di dua tempat: preview video dan canvas hasil foto.
const FILTERS = {
  normal: "none",
  warm: "sepia(0.35) saturate(1.3) brightness(1.05)",
  cool: "sepia(0.2) hue-rotate(170deg) saturate(1.3)",
  vintage: "sepia(0.6) contrast(1.1) brightness(0.95) saturate(0.9)",
  grayscale: "grayscale(1)",
  pink: "sepia(0.3) hue-rotate(300deg) saturate(1.6) brightness(1.05)",
  sunset: "sepia(0.4) saturate(1.8) hue-rotate(-20deg) contrast(1.05)",

  // Filter bergaya tren IG / TikTok (pendekatan memakai CSS filter)
  soft: "brightness(1.1) contrast(0.92) saturate(1.1)",                        // clean girl / soft glow
  y2k: "saturate(1.7) contrast(1.15) hue-rotate(-10deg) brightness(1.05)",     // warna ngejreng ala Y2K
  disposable: "contrast(1.25) saturate(1.3) sepia(0.15) brightness(1.05)",     // kamera disposable
  golden: "sepia(0.3) saturate(1.5) brightness(1.1) hue-rotate(-15deg)",       // golden hour
  moody: "contrast(1.2) brightness(0.85) saturate(0.8) sepia(0.15)",           // moody / dark academia
  noir: "grayscale(1) contrast(1.4) brightness(0.9)",                          // hitam putih tegas
  dreamy: "brightness(1.15) contrast(0.9) saturate(1.2) blur(0.6px)",          // dreamy blur
  peachy: "sepia(0.25) saturate(1.4) hue-rotate(-25deg) brightness(1.1)",      // peach tone
  matcha: "sepia(0.3) hue-rotate(50deg) saturate(1.2) brightness(1.05)"        // matcha green
};

// Daftar frame. Dipakai saat menggambar photo strip di canvas.
// bg & bg2 = warna latar (gradasi), text = warna tulisan,
// line & lineWidth = garis di sekeliling foto,
// shadow = bayangan foto, holes = lubang film
const FRAMES = {
  classic:  { bg: "#ffffff", bg2: "#ffffff", text: "#be185d", line: "#ec4899", lineWidth: 6,  shadow: false, holes: false },
  polaroid: { bg: "#fffdf7", bg2: "#fef3c7", text: "#44403c", line: "#ffffff", lineWidth: 14, shadow: true,  holes: false },
  pink:     { bg: "#fbcfe8", bg2: "#f9a8d4", text: "#9d174d", line: "#ffffff", lineWidth: 8,  shadow: false, holes: false },
  blue:     { bg: "#bae6fd", bg2: "#a5b4fc", text: "#1e3a8a", line: "#ffffff", lineWidth: 8,  shadow: false, holes: false },
  film:     { bg: "#1c1917", bg2: "#1c1917", text: "#fde68a", line: "#44403c", lineWidth: 4,  shadow: false, holes: true  },
  minimal:  { bg: "#faf5ff", bg2: "#faf5ff", text: "#4c1d95", line: "#000000", lineWidth: 0,  shadow: false, holes: false }
};

// Ukuran photo strip (satuan piksel di canvas)
const STRIP = {
  width: 620,
  photoW: 520,
  photoH: 390,
  gap: 24,
  header: 130,
  footer: 120
};


// ---------- 2. ELEMEN HTML ----------

const startBtn = document.getElementById("startBtn");
const startCameraBtn = document.getElementById("startCameraBtn");
const takePhotoBtn = document.getElementById("takePhotoBtn");
const downloadBtn = document.getElementById("downloadBtn");
const retakeBtn = document.getElementById("retakeBtn");
const newSessionBtn = document.getElementById("newSessionBtn");

const video = document.getElementById("video");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const cameraStatus = document.getElementById("cameraStatus");
const countdown = document.getElementById("countdown");
const flash = document.getElementById("flash");

const messageBox = document.getElementById("messageBox");
const resultMessage = document.getElementById("resultMessage");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const thumbnails = document.getElementById("thumbnails");

const timerOptions = document.getElementById("timerOptions");
const filterOptions = document.getElementById("filterOptions");
const frameOptions = document.getElementById("frameOptions");

const captureCanvas = document.getElementById("captureCanvas");
const stripCanvas = document.getElementById("stripCanvas");
const resultSection = document.getElementById("result");



// ---------- 3. VARIABEL KONDISI ----------

let stream = null;            // data kamera (null = kamera belum menyala)
let photos = [];              // array foto (berupa teks dataURL)
let selectedTimer = 3;        // detik
let selectedFilter = "normal";
let selectedFrame = "classic";
let isBusy = false;           // true saat countdown berjalan
let retakeIndex = null;       // nomor foto yang sedang diulang (null = tidak ada)


// ---------- 4. PESAN & STATUS ----------

// Menampilkan pesan di kotak tertentu. type: "error", "info", atau "success"
// Warna Tailwind untuk tiap jenis pesan
const MESSAGE_COLORS = {
  error: ["bg-red-100", "text-red-700"],
  info: ["bg-sky-100", "text-sky-700"],
  success: ["bg-emerald-100", "text-emerald-700"]
};
const ALL_COLORS = ["bg-red-100", "text-red-700", "bg-sky-100", "text-sky-700", "bg-emerald-100", "text-emerald-700", "bg-gray-200", "text-gray-700"];

// Menghapus semua class warna lama, lalu memasang warna baru
function setColors(element, colors) {
  ALL_COLORS.forEach(function (name) {
    element.classList.remove(name);
  });
  element.classList.add(colors[0], colors[1]);
}

// Menampilkan pesan di kotak tertentu. type: "error", "info", atau "success"
function showMessage(box, text, type) {
  box.textContent = text;
  box.classList.remove("hidden");
  setColors(box, MESSAGE_COLORS[type]);
}

function hideMessages() {
  messageBox.classList.add("hidden");
  resultMessage.classList.add("hidden");
}

// Mengubah label status kamera. state: "off", "ready", atau "error"
function setCameraStatus(text, state) {
  const colors = {
    off: ["bg-gray-200", "text-gray-700"],
    ready: ["bg-emerald-100", "text-emerald-700"],
    error: ["bg-red-100", "text-red-700"]
  };
  cameraStatus.textContent = text;
  setColors(cameraStatus, colors[state]);
}


// ---------- 5. KAMERA ----------

// Mengubah error teknis menjadi kalimat yang mudah dipahami
function getCameraErrorText(error) {
  if (error.name === "NotAllowedError" || error.name === "SecurityError") {
    return "Camera access was denied. Please allow camera permission.";
  }
  if (error.name === "NotFoundError") {
    return "No camera was found on this device.";
  }
  if (error.name === "NotReadableError" || error.name === "AbortError") {
    return "Your camera is being used by another app. Please close it and try again.";
  }
  return "Something went wrong while starting the camera. Please try again.";
}

async function startCamera() {
  hideMessages();

  // Cek apakah browser mendukung kamera
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setCameraStatus("Camera Error", "error");
    showMessage(messageBox, "Your browser does not support camera access. Please try Chrome, Edge, or Firefox.", "error");
    return;
  }

  startCameraBtn.disabled = true;

  try {
    // Minta izin kamera (audio tidak dibutuhkan)
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
    cameraPlaceholder.classList.add("hidden");
    startCameraBtn.textContent = "Camera On";
    setCameraStatus("Camera Ready", "ready");
  } catch (error) {
    stream = null;
    startCameraBtn.disabled = false;
    setCameraStatus("Camera Error", "error");
    showMessage(messageBox, getCameraErrorText(error), "error");
  }
}


// ---------- 6. PILIHAN TIMER / FILTER / FRAME ----------

// Memberi class "selected" hanya pada tombol yang dipilih di satu grup
function setActiveButton(groupElement, chosenButton) {
  const buttons = groupElement.querySelectorAll("button");
  buttons.forEach(function (button) {
    button.classList.remove("selected");
  });
  chosenButton.classList.add("selected");
}

// Memasang klik pada semua tombol dalam satu grup.
// attributeName contoh: "data-filter". onChoose = fungsi yang dijalankan saat dipilih.
function setupOptionGroup(groupElement, attributeName, onChoose) {
  const buttons = groupElement.querySelectorAll("button");
  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      setActiveButton(groupElement, button);
      onChoose(button.getAttribute(attributeName));
    });
  });
}

// Preview kamera mengikuti filter yang dipilih
function applyFilterToVideo() {
  video.style.filter = FILTERS[selectedFilter];
}

function chooseTimer(value) {
  selectedTimer = Number(value);
}

function chooseFilter(value) {
  selectedFilter = value;
  applyFilterToVideo();
}

function chooseFrame(value) {
  selectedFrame = value;
  // Jika 4 foto sudah selesai, gambar ulang strip dengan frame baru
  if (photos.length === TOTAL_PHOTOS) {
    drawPhotoStrip();
  }
}


// ---------- 7. COUNTDOWN ----------

// Menunggu beberapa milidetik (Promise + setTimeout)
function wait(milliseconds) {
  return new Promise(function (resolve) {
    setTimeout(resolve, milliseconds);
  });
}

// Menampilkan satu angka/kata countdown dengan animasi
function showCountdownText(text, isWord) {
  countdown.textContent = text;
  countdown.classList.remove("hidden", "text-8xl", "text-5xl");
  // Angka besar, kata "CHEESE!" lebih kecil agar muat. Mulai dari besar + transparan...
  countdown.classList.add(isWord ? "text-5xl" : "text-8xl", "scale-150", "opacity-0");
  void countdown.offsetWidth;   // paksa browser menghitung ulang agar transisi berjalan
  // ...lalu transition-all membuatnya mengecil dan muncul
  countdown.classList.remove("scale-150", "opacity-0");
}

function hideCountdown() {
  countdown.classList.add("hidden");
}

// Hitung mundur: 3, 2, 1, CHEESE!
async function runCountdown() {
  for (let number = selectedTimer; number >= 1; number--) {
    showCountdownText(number, false);
    await wait(1000);
  }
  showCountdownText("CHEESE!", true);
  await wait(600);
  hideCountdown();
}


// ---------- 8. AMBIL FOTO ----------

// Efek kilat putih
function showFlash() {
  flash.classList.remove("opacity-0");
  flash.classList.add("opacity-100");
  setTimeout(function () {
    flash.classList.remove("opacity-100");
    flash.classList.add("opacity-0");
  }, 150);
}

// Memperbarui teks "Photo X of 4" dan progress bar
function updateProgress() {
  progressText.textContent = "Photo " + photos.length + " of " + TOTAL_PHOTOS;
  progressBar.style.width = (photos.length / TOTAL_PHOTOS) * 100 + "%";
}

// Menaruh foto kecil di slot nomor "index" (0 = foto 1, dst.)
function setThumbnail(index, dataUrl) {
  const slot = thumbnails.children[index];
  const image = document.createElement("img");
  image.src = dataUrl;
  image.alt = "Photo " + (index + 1);
  slot.textContent = "";
  slot.appendChild(image);

  // Slot yang sudah berisi foto bisa diklik untuk retake
  slot.setAttribute("role", "button");
  slot.setAttribute("tabindex", "0");
  slot.setAttribute("aria-label", "Retake photo " + (index + 1));

  // Lepas class lalu pasang lagi agar animasi muncul ulang
  slot.classList.remove("filled", "retaking");
  void slot.offsetWidth;
  slot.classList.add("filled");
}

// Mengosongkan semua slot thumbnail
function clearThumbnails() {
  for (let i = 0; i < thumbnails.children.length; i++) {
    const slot = thumbnails.children[i];
    slot.textContent = i + 1;
    slot.classList.remove("filled", "retaking");
    slot.removeAttribute("role");
    slot.removeAttribute("tabindex");
    slot.removeAttribute("aria-label");
  }
}

// Teks tombol berubah saat sedang mengulang satu foto
function updateTakeButtonText() {
  if (retakeIndex !== null) {
    takePhotoBtn.textContent = "Retake Photo " + (retakeIndex + 1);
  } else {
    takePhotoBtn.textContent = "Take Photo";
  }
}

// Membatalkan mode retake (klik thumbnail yang sama sekali lagi)
function cancelRetakePhoto() {
  retakeIndex = null;
  for (let i = 0; i < thumbnails.children.length; i++) {
    thumbnails.children[i].classList.remove("retaking");
  }
  updateTakeButtonText();
  hideMessages();

  // Jika 4 foto sudah lengkap, tampilkan lagi hasilnya
  if (photos.length === TOTAL_PHOTOS) {
    resultSection.classList.remove("hidden");
    takePhotoBtn.disabled = true;
  }
}

// Dipanggil saat thumbnail diklik: pilih foto yang mau diulang
function selectPhotoToRetake(index) {
  // Abaikan jika countdown berjalan atau slot masih kosong
  if (isBusy || index >= photos.length) {
    return;
  }

  // Klik foto yang sama lagi = batal
  if (retakeIndex === index) {
    cancelRetakePhoto();
    return;
  }

  retakeIndex = index;
  for (let i = 0; i < thumbnails.children.length; i++) {
    thumbnails.children[i].classList.remove("retaking");
  }
  thumbnails.children[index].classList.add("retaking");

  updateTakeButtonText();
  takePhotoBtn.disabled = false;
  resultSection.classList.add("hidden");
  showMessage(messageBox, "Retaking photo " + (index + 1) + ". Press the button when you are ready. Tap the photo again to cancel.", "info");
  scrollToPhotobooth();
}

// Mengambil satu frame dari video lalu menyimpannya
function capturePhoto() {
  const ctx = captureCanvas.getContext("2d");
  captureCanvas.width = PHOTO_WIDTH;
  captureCanvas.height = PHOTO_HEIGHT;

  // Potong bagian tengah video agar rasionya 4:3
  let sourceWidth = video.videoWidth;
  let sourceHeight = video.videoHeight;
  if (sourceWidth / sourceHeight > 4 / 3) {
    sourceWidth = sourceHeight * 4 / 3;
  } else {
    sourceHeight = sourceWidth * 3 / 4;
  }
  const sourceX = (video.videoWidth - sourceWidth) / 2;
  const sourceY = (video.videoHeight - sourceHeight) / 2;

  // Pasang filter, lalu gambar video dalam keadaan dicerminkan (sama seperti preview)
  ctx.filter = FILTERS[selectedFilter];
  ctx.save();
  ctx.translate(PHOTO_WIDTH, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
  ctx.restore();
  ctx.filter = "none";

  // Simpan hasilnya sebagai teks gambar (dataURL)
  const dataUrl = captureCanvas.toDataURL("image/jpeg", 0.92);

  if (retakeIndex !== null) {
    // Mode retake: ganti foto lama di posisi yang sama
    photos[retakeIndex] = dataUrl;
    setThumbnail(retakeIndex, dataUrl);
    retakeIndex = null;
  } else {
    // Mode biasa: tambah foto baru di urutan berikutnya
    photos.push(dataUrl);
    setThumbnail(photos.length - 1, dataUrl);
  }

  updateProgress();
  updateTakeButtonText();
}

// Dijalankan saat tombol Take Photo ditekan
async function handleTakePhoto() {
  hideMessages();

  if (isBusy) {
    return;
  }
  if (!stream) {
    showMessage(messageBox, "Please start the camera first.", "error");
    return;
  }
  if (video.videoWidth === 0) {
    showMessage(messageBox, "The camera is still loading. Please wait a moment.", "info");
    return;
  }
  if (photos.length >= TOTAL_PHOTOS && retakeIndex === null) {
    showMessage(messageBox, "You already have all " + TOTAL_PHOTOS + " photos. Press Retake or New Session.", "info");
    return;
  }

  isBusy = true;
  takePhotoBtn.disabled = true;

  try {
    await runCountdown();
    capturePhoto();
    showFlash();
    isBusy = false;

    if (photos.length === TOTAL_PHOTOS) {
      await finishSession();
    } else {
      takePhotoBtn.disabled = false;
    }
  } catch (error) {
    isBusy = false;
    takePhotoBtn.disabled = false;
    hideCountdown();
    showMessage(messageBox, "Something went wrong while taking the photo. Please try again.", "error");
  }
}


// ---------- 9. PHOTO STRIP (CANVAS) ----------

// Mengubah dataURL menjadi gambar yang siap digambar ke canvas
function loadImage(source) {
  return new Promise(function (resolve, reject) {
    const image = new Image();
    image.onload = function () {
      resolve(image);
    };
    image.onerror = reject;
    image.src = source;
  });
}

// Tanggal hari ini, contoh: "06 OCT 2026"
function getTodayText() {
  const today = new Date();
  return today.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
}

function drawBackground(ctx, frame, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, frame.bg);
  gradient.addColorStop(1, frame.bg2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, STRIP.width, height);
}

// Lubang di kiri-kanan untuk frame Film
function drawFilmHoles(ctx, height) {
  ctx.fillStyle = "#f5f5f4";
  for (let y = 20; y < height - 20; y += 44) {
    ctx.fillRect(17, y, 16, 24);
    ctx.fillRect(STRIP.width - 33, y, 16, 24);
  }
}

function drawHeader(ctx, frame) {
  ctx.fillStyle = frame.text;
  ctx.textAlign = "center";
  ctx.font = "bold 64px Fredoka, sans-serif";
  ctx.fillText("SNAPLY", STRIP.width / 2, 78);
  ctx.font = "500 20px 'DM Sans', sans-serif";
  ctx.fillText("your little moments, captured", STRIP.width / 2, 108);
}

// Menggambar 4 foto dari atas ke bawah, lengkap dengan garis frame
function drawPhotos(ctx, images, frame) {
  const x = (STRIP.width - STRIP.photoW) / 2;

  for (let i = 0; i < images.length; i++) {
    const y = STRIP.header + i * (STRIP.photoH + STRIP.gap);

    if (frame.shadow) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;
    }
    ctx.drawImage(images[i], x, y, STRIP.photoW, STRIP.photoH);

    // Matikan bayangan agar tidak mengenai gambar lain
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    if (frame.lineWidth > 0) {
      ctx.strokeStyle = frame.line;
      ctx.lineWidth = frame.lineWidth;
      ctx.strokeRect(x - frame.lineWidth / 2, y - frame.lineWidth / 2, STRIP.photoW + frame.lineWidth, STRIP.photoH + frame.lineWidth);
    }
  }
}

function drawFooter(ctx, frame, height) {
  ctx.fillStyle = frame.text;
  ctx.textAlign = "center";
  ctx.font = "bold 32px Fredoka, sans-serif";
  ctx.fillText(getTodayText(), STRIP.width / 2, height - 52);
}

// Menggabungkan semua bagian menjadi satu photo strip
async function drawPhotoStrip() {
  const images = await Promise.all(photos.map(loadImage));


  const frame = FRAMES[selectedFrame];
  const height = STRIP.header + TOTAL_PHOTOS * STRIP.photoH + (TOTAL_PHOTOS - 1) * STRIP.gap + STRIP.footer;

  stripCanvas.width = STRIP.width;
  stripCanvas.height = height;
  const ctx = stripCanvas.getContext("2d");

  drawBackground(ctx, frame, height);
  if (frame.holes) {
    drawFilmHoles(ctx, height);
  }
  drawHeader(ctx, frame);
  drawPhotos(ctx, images, frame);
  drawFooter(ctx, frame, height);
}

// Dipanggil setelah foto ke-4: buat strip lalu tampilkan section hasil
async function finishSession() {
  try {
    await drawPhotoStrip();
    resultSection.classList.remove("hidden");
    resultSection.scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    takePhotoBtn.disabled = false;
    showMessage(messageBox, "Could not create the photo strip. Please press Retake.", "error");
  }
}


// ---------- 10. DOWNLOAD, RETAKE, NEW SESSION ----------

function downloadStrip() {
  hideMessages();

  if (photos.length < TOTAL_PHOTOS) {
    showMessage(messageBox, "Please finish all " + TOTAL_PHOTOS + " photos first.", "info");
    return;
  }

  try {
    // Buat link sementara lalu "klik" otomatis
    const link = document.createElement("a");
    link.download = "snaply-photostrip.png";
    link.href = stripCanvas.toDataURL("image/png");
    link.click();
  } catch (error) {
    showMessage(resultMessage, "Download failed. Please try again.", "error");
  }
}

// Menghapus foto dan progress (dipakai Retake dan New Session)
function clearPhotos() {
  photos = [];
  retakeIndex = null;
  isBusy = false;
  takePhotoBtn.disabled = false;
  hideMessages();
  hideCountdown();
  clearThumbnails();
  updateProgress();
  updateTakeButtonText();
  resultSection.classList.add("hidden");
}

function scrollToPhotobooth() {
  document.getElementById("photobooth").scrollIntoView({ behavior: "smooth" });
}

// Retake: ulangi 4 foto, pilihan filter dan frame tetap
function retake() {
  clearPhotos();
  scrollToPhotobooth();
}

// New Session: kembali ke kondisi awal (kamera tetap menyala)
function newSession() {
  clearPhotos();

  chooseTimer(3);
  setActiveButton(timerOptions, timerOptions.querySelector("[data-timer='3']"));

  chooseFilter("normal");
  setActiveButton(filterOptions, filterOptions.querySelector("[data-filter='normal']"));

  chooseFrame("classic");
  setActiveButton(frameOptions, frameOptions.querySelector("[data-frame='classic']"));

  scrollToPhotobooth();
}


// Ikon kecil untuk preview tombol frame dasar
const FRAME_ICONS = { classic: "🖼️", polaroid: "📷", pink: "💗", blue: "💙", film: "🎞️", minimal: "⬜" };

// ---------- 10B. PREVIEW PADA TOMBOL ----------

// Memberi kotak kecil berwarna (swatch) di dalam tombol filter dan frame
function addPreviews() {
  filterOptions.querySelectorAll("button").forEach(function (button) {
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = "linear-gradient(135deg, #fca5a5, #fde68a, #93c5fd)";
    swatch.style.filter = FILTERS[button.getAttribute("data-filter")];  // filter yang sama dengan kamera
    button.prepend(swatch);
  });

  frameOptions.querySelectorAll("button").forEach(function (button) {
    const name = button.getAttribute("data-frame");
    const frame = FRAMES[name];
    const colors = frame.patternColors || [frame.bg, frame.bg2];
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = "linear-gradient(135deg, " + colors.join(", ") + ")";
    swatch.style.borderColor = frame.text;
    swatch.textContent = FRAME_ICONS[name] || "";
    button.prepend(swatch);
  });
}

// Tanggal di gambar hero ikut tanggal hari ini
function showHeroDate() {
  document.getElementById("heroDate").textContent = getTodayText();
}


// ---------- 11. PASANG EVENT ----------

startBtn.addEventListener("click", scrollToPhotobooth);
startCameraBtn.addEventListener("click", startCamera);
takePhotoBtn.addEventListener("click", handleTakePhoto);
downloadBtn.addEventListener("click", downloadStrip);
retakeBtn.addEventListener("click", retake);
newSessionBtn.addEventListener("click", newSession);

setupOptionGroup(timerOptions, "data-timer", chooseTimer);
setupOptionGroup(filterOptions, "data-filter", chooseFilter);
setupOptionGroup(frameOptions, "data-frame", chooseFrame);

// Klik (atau Enter / Spasi) pada thumbnail = ulangi foto itu
for (let i = 0; i < thumbnails.children.length; i++) {
  thumbnails.children[i].addEventListener("click", function () {
    selectPhotoToRetake(i);
  });
  thumbnails.children[i].addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectPhotoToRetake(i);
    }
  });
}

// Tampilan awal
addPreviews();
showHeroDate();
updateProgress();