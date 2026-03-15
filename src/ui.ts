import { IconPicture } from '@codexteam/icons';
import { make } from './utils/dom';
import type { API } from '@editorjs/editorjs';
import type { ImageConfig } from './types/types';

/**
 * Enumeration representing the different states of the UI.
 */
export enum UiState {
  /**
   * The UI is in an empty state, with no image loaded or being selected.
   */
  Empty = 'empty',

  /**
   * The UI is in an uploading state, indicating an image is currently being uploaded.
   */
  Uploading = 'uploading',

  /**
   * The UI is in a filled state, with an image successfully loaded.
   */
  Filled = 'filled'
};

/**
 * Nodes interface representing various elements in the UI.
 */
interface Nodes {
  /**
   * Wrapper element in the UI.
   */
  wrapper: HTMLElement;

  /**
   * Figure element wrapping image + caption (for centering).
   */
  figure: HTMLElement;

  /**
   * Container for the image element in the UI.
   */
  imageContainer: HTMLElement;

  /**
   * Button for selecting files.
   */
  fileButton: HTMLElement;

  /**
   * Represents the image element in the UI, if one is present; otherwise, it's undefined.
   */
  imageEl?: HTMLElement;

  /**
   * Preloader element for the image.
   */
  imagePreloader: HTMLElement;

  /**
   * Caption element for the image.
   */
  caption: HTMLElement;
}

/**
 * ConstructorParams interface representing parameters for the Ui class constructor.
 */
interface ConstructorParams {
  /**
   * Editor.js API.
   */
  api: API;
  /**
   * Configuration for the image.
   */
  config: ImageConfig;
  /**
   * Callback function for selecting a file.
   */
  onSelectFile: () => void;
  /**
   * Flag indicating if the UI is in read-only mode.
   */
  readOnly: boolean;
}

/**
 * Class for working with UI:
 *  - rendering base structure
 *  - show/hide preview
 *  - apply tune view
 */
export default class Ui {
  /**
   * Nodes representing various elements in the UI.
   */
  public nodes: Nodes;

  /**
   * API instance for Editor.js.
   */
  private api: API;

  /**
   * Configuration for the image tool.
   */
  private config: ImageConfig;

  /**
   * Callback function for selecting a file.
   */
  private onSelectFile: () => void;

  /**
   * Flag indicating if the UI is in read-only mode.
   */
  private readOnly: boolean;

  /**
   * @param ui - image tool Ui module
   * @param ui.api - Editor.js API
   * @param ui.config - user config
   * @param ui.onSelectFile - callback for clicks on Select file button
   * @param ui.readOnly - read-only mode flag
   */
  constructor({ api, config, onSelectFile, readOnly }: ConstructorParams) {
    this.api = api;
    this.config = config;
    this.onSelectFile = onSelectFile;
    this.readOnly = readOnly;
    this.nodes = {
      wrapper: make('div', [this.CSS.baseClass, this.CSS.wrapper]),
      figure: make('div', [this.CSS.figure]),
      imageContainer: make('div', [this.CSS.imageContainer]),
      fileButton: this.createFileButton(),
      imageEl: undefined,
      imagePreloader: make('div', this.CSS.imagePreloader),
      caption: make('div', [this.CSS.input, this.CSS.caption], {
        contentEditable: !this.readOnly,
      }),
    };

    /**
     * Create base structure
     *  <wrapper>
     *    <figure>
     *      <image-container>
     *        <image-preloader />
     *      </image-container>
     *      <caption />
     *    </figure>
     *    <select-file-button />
     *  </wrapper>
     */
    this.nodes.caption.dataset.placeholder = this.config.captionPlaceholder;
    this.nodes.imageContainer.appendChild(this.nodes.imagePreloader);
    this.nodes.figure.appendChild(this.nodes.imageContainer);
    this.nodes.figure.appendChild(this.nodes.caption);
    this.nodes.wrapper.appendChild(this.nodes.figure);
    this.nodes.wrapper.appendChild(this.nodes.fileButton);

    if (!this.readOnly) {
      this.lockCaptionNavigationInside();
    }
  }

  /**
   * Prevent arrow-navigation keystrokes inside caption from bubbling up to Editor.js,
   * which can interpret boundary arrows as block navigation.
   */
  private lockCaptionNavigationInside(): void {
    const lockedKeys = new Set([
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
    ]);

    this.nodes.caption.addEventListener(
      'keydown',
      (event: KeyboardEvent) => {
        if (lockedKeys.has(event.key)) {
          /**
           * Do not preventDefault — keep native caret movement inside caption.
           * Only stop propagation so Editor.js won't treat it as block navigation.
           */
          event.stopPropagation();
          event.stopImmediatePropagation();
          return;
        }

        if (event.key === 'Backspace' && this.isCaretAtCaptionStart()) {
          /**
           * When caret is at the very beginning, Editor.js can interpret Backspace as a block-level action.
           * Keep native behavior (no preventDefault), just stop bubbling.
           */
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
      },
      true
    );
  }

  private isCaretAtCaptionStart(): boolean {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      return false;
    }

    const range = selection.getRangeAt(0);

    if (!range.collapsed) {
      return false;
    }

    if (!this.nodes.caption.contains(range.startContainer)) {
      return false;
    }

    /**
     * Build a range from caption start to caret and see if it contains any text.
     * If empty, caret is at the visual beginning (including empty/<br> cases).
     */
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(this.nodes.caption);

    try {
      preCaretRange.setEnd(range.startContainer, range.startOffset);
    } catch {
      return false;
    }

    return preCaretRange.toString() === '';
  }

  /**
   * Apply visual representation of activated tune
   * @param tuneName - one of available tunes {@link Tunes.tunes}
   * @param status - true for enable, false for disable
   */
  public applyTune(tuneName: string, status: boolean): void {
    this.nodes.wrapper.classList.toggle(`${this.CSS.wrapper}--${tuneName}`, status);
  }

  /**
   * Renders tool UI
   */
  public render(): HTMLElement {
    this.toggleStatus(UiState.Empty);

    return this.nodes.wrapper;
  }

  /**
   * Shows uploading preloader
   * @param src - preview source
   */
  public showPreloader(src: string): void {
    this.nodes.imagePreloader.style.backgroundImage = `url(${src})`;

    this.toggleStatus(UiState.Uploading);
  }

  /**
   * Hide uploading preloader
   */
  public hidePreloader(): void {
    this.nodes.imagePreloader.style.backgroundImage = '';
    this.toggleStatus(UiState.Empty);
  }

  /**
   * Shows an image
   * @param url - image source
   */
  public fillImage(url: string): void {
    /**
     * Check for a source extension to compose element correctly: video tag for mp4, img — for others
     */
    const tag = /\.mp4$/.test(url) ? 'VIDEO' : 'IMG';

    const attributes: { [key: string]: string | boolean } = {
      src: url,
    };

    /**
     * We use eventName variable because IMG and VIDEO tags have different event to be called on source load
     * - IMG: load
     * - VIDEO: loadeddata
     */
    let eventName = 'load';

    /**
     * Update attributes and eventName if source is a mp4 video
     */
    if (tag === 'VIDEO') {
      /**
       * Add attributes for playing muted mp4 as a gif
       */
      attributes.autoplay = true;
      attributes.loop = true;
      attributes.muted = true;
      attributes.playsinline = true;

      /**
       * Change event to be listened
       */
      eventName = 'loadeddata';
    }

    /**
     * Compose tag with defined attributes
     */
    this.nodes.imageEl = make(tag, this.CSS.imageEl, attributes);

    /**
     * Add load event listener
     */
    this.nodes.imageEl.addEventListener(eventName, () => {
      this.toggleStatus(UiState.Filled);

      /**
       * Preloader does not exists on first rendering with presaved data
       */
      if (this.nodes.imagePreloader !== undefined) {
        this.nodes.imagePreloader.style.backgroundImage = '';
      }
    });

    this.nodes.imageContainer.appendChild(this.nodes.imageEl);
  }

  /**
   * Shows caption input
   * @param text - caption content text
   */
  public fillCaption(text: string): void {
    if (this.nodes.caption !== undefined) {
      this.nodes.caption.innerHTML = text;
    }
  }

  /**
   * Changes UI status
   * @param status - see {@link Ui.status} constants
   */
  public toggleStatus(status: UiState): void {
    for (const statusType in UiState) {
      if (Object.prototype.hasOwnProperty.call(UiState, statusType)) {
        const state = UiState[statusType as keyof typeof UiState];

        this.nodes.wrapper.classList.toggle(`${this.CSS.wrapper}--${state}`, state === status);
      }
    }
  }

  /**
   * CSS classes
   */
  private get CSS(): Record<string, string> {
    return {
      baseClass: this.api.styles.block,
      loading: this.api.styles.loader,
      input: this.api.styles.input,
      button: this.api.styles.button,

      /**
       * Tool's classes
       */
      wrapper: 'image-tool',
      figure: 'image-tool__figure',
      imageContainer: 'image-tool__image',
      imagePreloader: 'image-tool__image-preloader',
      imageEl: 'image-tool__image-picture',
      caption: 'image-tool__caption',
    };
  };

  /**
   * Creates upload-file button
   */
  private createFileButton(): HTMLElement {
    const button = make('div', [this.CSS.button]);

    button.innerHTML = this.config.buttonContent ?? `${IconPicture} ${this.api.i18n.t('Select an Image')}`;

    button.addEventListener('click', () => {
      this.onSelectFile();
    });

    return button;
  }
}
