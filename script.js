'use strict';

const form = document.querySelector('#form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const sortContainer = document.querySelector('.sort__container');
const deleteAllBtn = document.querySelector('#clearAll');

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration) {
    this.coords = coords; // [latitude, longitude]
    this.distance = distance; // in km
    this.duration = duration; // in min
    this.calcSpeed();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this._setDescription();
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this._setDescription();
  }
}

//////////////////////////////////////
//// Application Architecture

class App {
  #map;
  #mapEvent;
  #mapZoomLevel = 13;
  #workouts = [];
  #markers = [];

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener(
      'click',
      this._workoutHandler.bind(this)
    );
    containerWorkouts.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        this._updateWorkout(e);
      }
    });
    sortContainer.addEventListener('change', this._sortHandler.bind(this));
    deleteAllBtn.addEventListener('click', this._deleteAllConfirm.bind(this));
  }

  _getPosition() {
    // Access current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position.');
        }
      );
    } else {
      alert('Your browser does not support location features.');
    }
  }

  _loadMap(position) {
    // Display map at current location
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handle clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    // Prevent animation from appearing so new workout looks like it replaces the form element
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout is running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout is cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkoutList(workout);

    // Hide form & clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _findWorkout(workoutEl) {
    return this.#workouts.find(work => work.id === workoutEl.dataset.id);
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    this.#markers.push(marker);
  }

  _renderWorkoutList(workout) {
    const isRunning = (a, b) => (workout.type === 'running' ? a : b);

    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__settings workout__settings--move"><svg class="icon"><use xlink:href="./icons.svg#icon-location"></use></svg></div>
        <div class="workout__settings workout__settings--edit"><svg class="icon"><use xlink:href="./icons.svg#icon-pencil"></use></svg></div>
        <div class="workout__settings workout__settings--delete"><svg class="icon"><use xlink:href="./icons.svg#icon-cross"></use></svg></div>
        <div class="workout__details">
          <span class="workout__icon">${isRunning('🏃‍♂️', '🚴‍♀️')}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
        <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">${isRunning('🦶🏼', '⛰')}</span>
            <span class="workout__value">${isRunning(
              workout.cadence,
              workout.elevationGain
            )}</span>
            <span class="workout__unit">${isRunning('spm', 'm')}</span>
          </div>
      </li>
    `;

    form.insertAdjacentHTML('afterend', html);

    // Show sort and delete
    sortContainer.classList.remove('hidden');
  }

  _newWorkoutList() {
    // Remove list of workouts
    document.querySelectorAll('.workout').forEach(workout => workout.remove());

    // Update local storage
    this._setLocalStorage();

    // Restore workouts list from local storage
    this._getLocalStorage();
  }

  _moveToPopup(workoutEl) {
    const workout = this._findWorkout(workoutEl);

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      // Convert string to data object
      work.date = new Date(work.date);
      // Render workout list element
      this._renderWorkoutList(work);
      // Re-link prototype from original class
      if (work.type === 'running') work.__proto__ = Running.prototype;
      if (work.type === 'cycling') work.__proto__ = Cycling.prototype;
    });
  }

  _workoutHandler(e) {
    const workoutEl = e.target.closest('.workout');

    const setting = e.target.closest('.workout__settings');
    if (!setting) return;

    if (setting.classList.contains('workout__settings--delete'))
      this._deleteWorkout(workoutEl);

    if (setting.classList.contains('workout__settings--move'))
      this._moveToPopup(workoutEl);

    if (setting.classList.contains('workout__settings--edit'))
      this._editWorkoutFields(workoutEl);
  }

  _sortHandler(e) {
    const sortBy = e.target.value;
    if (!sortBy) return;

    const [value, direction] = sortBy.split(' ');

    this._sortWorkouts(value, direction);

    this._newWorkoutList();
  }

  _sortWorkouts(value, direction) {
    return this.#workouts.sort((a, b) => {
      // Sort workouts by value either ascending or descending
      return direction === 'asc' ? a[value] - b[value] : b[value] - a[value];
    });
  }

  _deleteAllConfirm() {
    const confirm = window.confirm(
      "Are you sure you want to delete all workouts? This can't be undone"
    );

    if (confirm) this.reset();
    else return;
  }

  _deleteWorkout(workoutEl) {
    const workout = this._findWorkout(workoutEl);

    const workoutIndex = this.#workouts.findIndex(
      work => workout.id === work.id
    );

    // Find and remove popup on map
    this.#markers.find((_, i) => i === workoutIndex).remove();
    // Remove workout HTML element
    workoutEl.remove();
    // Delete marker from array
    this.#markers = this.#markers.filter((_, i) => i !== workoutIndex);
    // Delete workout from array
    this.#workouts = this.#workouts.filter(
      item => item.id !== workoutEl.dataset.id
    );
    // Update local storage
    this._setLocalStorage();
  }

  _editWorkoutFields(workoutEl) {
    const details = workoutEl.querySelectorAll('.workout__details');

    details.forEach((el, i) => {
      // Skip speed field
      if (i === 2) return;

      const valueEl = el.querySelector('.workout__value');

      const value = valueEl.textContent;
      // Replace span elements with input elements with input value set from span value
      valueEl.innerHTML = `<input 
        type="text"
        class="workout__value form__input"
        value="${value}"
        style="width: 3.5rem; padding: 0rem; text-align: center;"
      >`;
    });
  }

  _updateWorkout(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this._findWorkout(workoutEl);

    const [distance, duration, paceOrElevation] = document.querySelectorAll(
      '.workout__value.form__input'
    );

    // Update current workout with new values
    workout.distance = +distance.value;
    workout.duration = +duration.value;
    if (workout.type === 'running') {
      workout.cadence = +paceOrElevation.value;
    }
    if (workout.type === 'cycling') {
      workout.elevationGain = +paceOrElevation.value;
    }
    workout.calcSpeed();

    // Find index of current workout in workouts array
    const workoutIndex = this.#workouts.findIndex(
      work => work.id === workout.id
    );

    // Replace old workout entry with edited workout
    this.#workouts[workoutIndex] = workout;

    // Re-draw workout list
    this._newWorkoutList();
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
