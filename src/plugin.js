import videojs from 'video.js';
import {version as VERSION} from '../package.json';
import ConcreteButton from './ConcreteButton';
import ConcreteMenuItem from './ConcreteMenuItem';

// Default options for the plugin.
const defaults = {
  sortAscending: false,
  autoPlacement: 'top'
};

// Cross-compatibility for Video.js 5 and 6.
const registerPlugin = videojs.registerPlugin || videojs.plugin;
// const dom = videojs.dom || videojs;

/**
 * VideoJS HLS Quality Selector Plugin class.
 */
class HlsQualitySelectorPlugin {

  /**
   * Plugin Constructor.
   *
   * @param {Player} player - The videojs player instance.
   * @param {Object} options - The plugin options.
   */
  constructor(player, options) {
    this.player = player;
    this.config = options;

    // Ensure dependencies are met
    if (!this.player.qualityLevels) {
      console.warn(`Error: Missing videojs-contrib-quality-levels plugin (required by videojs-hls-quality-selector)\nhttps://github.com/videojs/videojs-contrib-quality-levels`);
      return;
    }

    // Begin plugin setup
    this.setupPlugin();
  }

  /**
   * Setups the plugin, creates DOM elements, adds event listeners
   */
  setupPlugin() {
    // Create the quality selector button.
    this.createQualityButton();
    this.bindPlayerEvents();
    // Listen for video source changes
    this.player.on('loadedmetadata', () => this.updatePlugin());
  }

  /**
   * Updates the UI when video.js source changes
   */
   updatePlugin() {
    // If there is the HLS tech
    if (this.getHls()) {
      // Show the quality selector button
      this._qualityButton.show();
    } else {
      // Hide the quality selector
      this._qualityButton.hide();
    }
  }

  /**
   * Returns HLS Plugin
   *
   * @return {*} - videojs-hls-contrib plugin.
   */
  getHls() {
    return this.player.tech({ IWillNotUseThisInPlugins: true }).vhs;
  }

  /**
   * Binds listener for quality level changes.
   */
  bindPlayerEvents() {
    this.player.qualityLevels().on('addqualitylevel', this.onAddQualityLevel.bind(this));
  }

  /**
   * Adds the quality menu button to the player control bar.
   */
  createQualityButton() {

    const player = this.player;

    this._qualityButton = new ConcreteButton(player);

    const placementIndex = player.controlBar.children().length - 2;
    const concreteButtonInstance = player.controlBar.addChild(this._qualityButton,
      {componentClass: 'qualitySelector'},
      this.config.placementIndex || placementIndex);

    concreteButtonInstance.addClass('vjs-quality-selector');
    if (!this.config.displayCurrentQuality) {
      const icon = ` ${this.config.vjsIconClass || 'vjs-icon-hd'}`;

      concreteButtonInstance
        .menuButton_.$('.vjs-icon-placeholder').className += icon;
    } else {
      this.setButtonInnerText('auto');
    }
    concreteButtonInstance.removeClass('vjs-hidden');

  }

  /**
   *Set inner button text.
   *
   * @param {string} text - the text to display in the button.
   */
  setButtonInnerText(text) {
    this._qualityButton
      .menuButton_.$('.vjs-icon-placeholder').innerHTML = text;
  }

  /**
   * Builds individual quality menu items.
   *
   * @param {Object} item - Individual quality menu item.
   * @return {ConcreteMenuItem} - Menu item
   */
  getQualityMenuItem(item) {
    const player = this.player;

    return new ConcreteMenuItem(player, item, this._qualityButton, this);
  }

  /**
   * Executed when a quality level is added from HLS playlist.
   */
  onAddQualityLevel() {

    const player = this.player;
    const qualityList = player.qualityLevels();
    const levels = qualityList.levels_ || [];
    const levelItems = [];
    const autoPlacement = this.config.autoPlacement;
    const autoMenuItem = this.getQualityMenuItem.call(this, {
      label: player.localize('Auto'),
      value: 'auto',
      selected: true
    });

    for (let i = 0; i < levels.length; ++i) {
      const {width, height} = levels[i];
      const pixels = width > height ? height : width;

      if (!pixels) {
        continue;
      }

      if (!levelItems.filter(_existingItem => {
        return _existingItem.item && _existingItem.item.value === pixels;
      }).length) {
        const levelItem = this.getQualityMenuItem.call(this, {
          label: pixels + 'p',
          value: pixels
        });

        // Check if the level is enabled
        if (levels[i].enabled) {
          levelItems.push(levelItem);
        }
      }
    }

    // sort the quality level values
    if (this.config.sortAscending) {
      levelItems.sort((current, next) => {
        if ((typeof current !== 'object') || (typeof next !== 'object')) {
          return -1;
        }
        return current.item.value - next.item.value;
      });
    } else {
      levelItems.sort((current, next) => {
        if ((typeof current !== 'object') || (typeof next !== 'object')) {
          return -1;
        }
        return next.item.value - current.item.value;
      });
    }


    if (this._qualityButton) {
      this._qualityButton.createItems = function() {
        // put 'auto' at the top or bottom per option parameter
        return autoPlacement === 'top' ? [autoMenuItem, ...levelItems] :
          [...levelItems, autoMenuItem];
      };
      this._qualityButton.update();
    }

  }

  /**
   * Sets quality (based on media short side)
   *
   * @param {number} quality - A number representing HLS playlist.
   */
  setQuality(quality) {
    const qualityList = this.player.qualityLevels();

    // Set quality on plugin
    this._currentQuality = quality;

    if (this.config.displayCurrentQuality) {
      this.setButtonInnerText(quality === 'auto' ? quality : `${quality}p`);
    }

    for (let i = 0; i < qualityList.length; ++i) {
      const {width, height} = qualityList[i];
      const pixels = width > height ? height : width;

      qualityList[i].enabled = (pixels === quality || quality === 'auto');
    }

    if (this._qualityButton) {
      this._qualityButton.unpressButton();
    }
  }

  /**
   * Return the current set quality or 'auto'
   *
   * @return {string} the currently set quality
   */
  getCurrentQuality() {
    return this._currentQuality || 'auto';
  }

}

/**
 * Function to invoke when the player is ready.
 *
 * This is a great place for your plugin to initialize itself. When this
 * function is called, the player will have its DOM and child components
 * in place.
 *
 * @function onPlayerReady
 * @param    {Player} player
 *           A Video.js player object.
 *
 * @param    {Object} [options={}]
 *           A plain object containing options for the plugin.
 */
const onPlayerReady = (player, options) => {
  player.addClass('vjs-hls-quality-selector');
  player.hlsQualitySelector = new HlsQualitySelectorPlugin(player, options);
};

/**
 * A video.js plugin.
 *
 * In the plugin function, the value of `this` is a video.js `Player`
 * instance. You cannot rely on the player being in a "ready" state here,
 * depending on how the plugin is invoked. This may or may not be important
 * to you; if not, remove the wait for "ready"!
 *
 * @function hlsQualitySelector
 * @param    {Object} [options={}]
 *           An object of options left to the plugin author to define.
 */
const hlsQualitySelector = function(options) {
  this.ready(() => {
    onPlayerReady(this, videojs.mergeOptions(defaults, options));
  });
};

// Register the plugin with video.js.
registerPlugin('hlsQualitySelector', hlsQualitySelector);

// Include the version number.
hlsQualitySelector.VERSION = VERSION;

export default hlsQualitySelector;
