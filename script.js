const cities = {
  tashkent: { lat: 41.2995, lng: 69.2401, name: "Toshkent" },
  samarkand: { lat: 39.6270, lng: 66.9750, name: "Samarqand" },
  bukhara: { lat: 39.7680, lng: 64.4210, name: "Buxoro" },
  andijan: { lat: 40.7829, lng: 72.3442, name: "Andijon" },
  namangan: { lat: 41.0011, lng: 71.6724, name: "Namangan" },
  custom: { lat: null, lng: null, name: "Mening Joyim" }
};

const prayerNames = {
  fajr: "Bomdod",
  sunrise: "Quyosh",
  dhuhr: "Peshin",
  asr: "Asr",
  maghrib: "Shom",
  isha: "Xufton"
};

let currentLocation = cities.tashkent;
let cachedTimes = null;
let lastUpdate = null;

async function getLocation() {
  const loading = document.getElementById('loading');
  loading.style.display = 'block';

  try {
      const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const { latitude, longitude } = position.coords;
      currentLocation = {
          lat: latitude,
          lng: longitude,
          name: "Mening Joyim"
      };

      try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const data = await response.json();
          currentLocation.name = data.address.city || data.address.town || "Mening Joyim";
      } catch (error) {
          console.error('Error getting location name:', error);
      }

      document.getElementById('citySelect').value = 'custom';
      document.getElementById('locationDisplay').textContent = 
          `${currentLocation.name} (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
      
      cachedTimes = null;
      await update();
  } catch (error) {
      alert('Joylashuvni aniqlashda xatolik yuz berdi. Iltimos, shaharni ro\'yxatdan tanlang.');
      console.error('Error getting location:', error);
  } finally {
      loading.style.display = 'none';
  }
}

async function getPrayerTimes(lat, lng) {
  const date = new Date();
  const today = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;

  // Check cache
  if (cachedTimes && lastUpdate === today) {
      return cachedTimes;
  }

  try {
      const response = await fetch(`https://api.aladhan.com/v1/timings/${today}?latitude=${lat}&longitude=${lng}&method=3`);
      const data = await response.json();
      const timings = data.data.timings;

      const times = {
          fajr: new Date(`${date.toDateString()} ${timings.Fajr}`),
          sunrise: new Date(`${date.toDateString()} ${timings.Sunrise}`),
          dhuhr: new Date(`${date.toDateString()} ${timings.Dhuhr}`),
          asr: new Date(`${date.toDateString()} ${timings.Asr}`),
          maghrib: new Date(`${date.toDateString()} ${timings.Maghrib}`),
          isha: new Date(`${date.toDateString()} ${timings.Isha}`)
      };

      // Update cache
      cachedTimes = times;
      lastUpdate = today;

      return times;
  } catch (error) {
      console.error('Error fetching prayer times:', error);
      return null;
  }
}

function formatTime(date) {
  return date.toLocaleTimeString('uz-UZ', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false
  });
}

function updateCurrentTime() {
  const now = new Date();
  document.getElementById('currentTime').textContent = 
      `Joriy vaqt: ${formatTime(now)}`;
}

function getNextPrayer(times) {
  const now = new Date();
  let nextPrayer = null;
  let nextPrayerTime = null;

  for (const [prayer, time] of Object.entries(times)) {
      if (time > now) {
          nextPrayer = prayer;
          nextPrayerTime = time;
          break;
      }
  }

  if (!nextPrayer) {
      nextPrayer = 'fajr';
      nextPrayerTime = new Date(times.fajr);
      nextPrayerTime.setDate(nextPrayerTime.getDate() + 1);
  }

  return { name: nextPrayer, time: nextPrayerTime };
}

function updateCountdown(nextPrayerTime) {
  const now = new Date();
  const diff = nextPrayerTime - now;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

async function updatePrayerTimes() {
  const times = await getPrayerTimes(currentLocation.lat, currentLocation.lng);
  if (!times) return null;

  const prayerTimesContainer = document.getElementById('prayerTimes');
  prayerTimesContainer.innerHTML = '';

  const now = new Date();
  for (const [prayer, time] of Object.entries(times)) {
      const div = document.createElement('div');
      div.className = 'prayer-time' + (time > now && !nextPrayerFound ? ' active' : '');
      div.innerHTML = `
          <span class="prayer-name">${prayerNames[prayer]}</span>
          <span class="prayer-time-value">${formatTime(time)}</span>
      `;
      prayerTimesContainer.appendChild(div);
      if (time > now && !nextPrayerFound) nextPrayerFound = true;
  }

  return times;
}

async function update() {
  const times = await updatePrayerTimes();
  if (!times) return;

  const nextPrayer = getNextPrayer(times);
  
  document.getElementById('nextPrayer').textContent = 
      `${prayerNames[nextPrayer.name]} - ${formatTime(nextPrayer.time)}`;
  document.getElementById('countdown').textContent = 
      updateCountdown(nextPrayer.time);
  updateCurrentTime();
}

document.getElementById('citySelect').addEventListener('change', async function(e) {
  const selectedCity = e.target.value;
  if (selectedCity !== 'custom') {
      currentLocation = cities[selectedCity];
      document.getElementById('locationDisplay').textContent = currentLocation.name;
      cachedTimes = null;
      await update();
  }
});

document.getElementById('geoButton').addEventListener('click', getLocation);

// Check if we need to refresh the times (e.g., after midnight)
function checkDateChange() {
  const now = new Date();
  const today = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
  if (lastUpdate !== today) {
      cachedTimes = null;
      update();
  }
}

// Initial update
update();

// Update countdown every second
setInterval(() => {
  updateCurrentTime();
  checkDateChange();
  
  const countdown = document.getElementById('countdown');
  if (countdown.textContent) {
      const [hours, minutes, seconds] = countdown.textContent.split(':').map(Number);
      let totalSeconds = hours * 3600 + minutes * 60 + seconds - 1;
      
      if (totalSeconds < 0) {
          update();
      } else {
          const h = Math.floor(totalSeconds / 3600);
          const m = Math.floor((totalSeconds % 3600) / 60);
          const s = totalSeconds % 60;
          countdown.textContent = 
              `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      }
  }
}, 1000);