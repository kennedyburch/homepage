// Weather Widget Implementation
class WeatherWidget {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      refreshInterval: 600000, // 10 minutes
      units: 'metric',
      ...options
    };
    
    if (!this.container) {
      console.error('Weather widget container not found');
      return;
    }
    
    this.init();
  }

  async init() {
    try {
      await this.getUserLocation();
      await this.fetchWeather();
      this.setupAutoRefresh();
    } catch (error) {
      this.showError('Failed to load weather data');
      console.error('Weather widget initialization error:', error);
    }
  }

  async getUserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        // Fallback to a default location (New York City)
        this.latitude = 40.7128;
        this.longitude = -74.0060;
        this.locationName = 'New York, NY';
        resolve();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.latitude = position.coords.latitude;
          this.longitude = position.coords.longitude;
          resolve();
        },
        (error) => {
          console.warn('Geolocation failed, using default location:', error);
          // Fallback to default location
          this.latitude = 40.7128;
          this.longitude = -74.0060;
          this.locationName = 'Default Location';
          resolve();
        },
        { timeout: 10000, enableHighAccuracy: false }
      );
    });
  }

  async fetchWeather() {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.latitude}&longitude=${this.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }
      
      const data = await response.json();
      this.displayWeather(data);
      
    } catch (error) {
      console.error('Failed to fetch weather:', error);
      this.showError('Unable to load weather data');
    }
  }

  displayWeather(data) {
    const { current } = data;
    
    // Create weather content HTML
    const weatherContent = `
      <div class="weather-content loaded">
        <div class="weather-temp">${Math.round(current.temperature_2m)}°C</div>
        <div class="weather-description">${this.getWeatherDescription(current.weather_code)}</div>
        ${this.locationName ? `<div class="weather-location">${this.locationName}</div>` : ''}
        <div class="weather-details">
          <div class="weather-detail">
            <div class="weather-detail-label">Humidity</div>
            <div>${current.relative_humidity_2m}%</div>
          </div>
          <div class="weather-detail">
            <div class="weather-detail-label">Wind</div>
            <div>${Math.round(current.wind_speed_10m)} km/h</div>
          </div>
        </div>
      </div>
    `;
    
    // Hide loading and show content
    this.container.innerHTML = weatherContent;
  }

  getWeatherDescription(code) {
    const weatherCodes = {
      0: '☀️ Clear sky',
      1: '🌤️ Mainly clear',
      2: '⛅ Partly cloudy',
      3: '☁️ Overcast',
      45: '🌫️ Fog',
      48: '🌫️ Depositing rime fog',
      51: '🌦️ Light drizzle',
      53: '🌦️ Moderate drizzle',
      55: '🌦️ Dense drizzle',
      61: '🌧️ Slight rain',
      63: '🌧️ Moderate rain',
      65: '🌧️ Heavy rain',
      71: '❄️ Slight snow',
      73: '❄️ Moderate snow',
      75: '❄️ Heavy snow',
      77: '❄️ Snow grains',
      80: '🌦️ Slight rain showers',
      81: '🌦️ Moderate rain showers',
      82: '🌦️ Violent rain showers',
      85: '🌨️ Slight snow showers',
      86: '🌨️ Heavy snow showers',
      95: '⛈️ Thunderstorm',
      96: '⛈️ Thunderstorm with hail',
      99: '⛈️ Thunderstorm with heavy hail'
    };
    
    return weatherCodes[code] || '🌤️ Unknown';
  }

  showError(message) {
    this.container.innerHTML = `
      <div class="weather-error show">
        ⚠️ ${message}
      </div>
    `;
  }

  setupAutoRefresh() {
    setInterval(() => {
      this.fetchWeather();
    }, this.options.refreshInterval);
  }
}

// Initialize weather widget when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new WeatherWidget('weather-widget');
});
