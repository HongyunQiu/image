import { IconPicture } from '@codexteam/icons';
import { make } from './utils/dom';
import type { API } from '@editorjs/editorjs';
import type { ImageConfig, ImageDisplaySize, ImageAlignment } from './types/types';

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
   * Row containing caption input and display size controls.
   */
  controls: HTMLElement;

  /**
   * Caption element for the image.
   */
  caption: HTMLElement;

  /**
   * Button for switching alignment.
   */
  alignButton: HTMLButtonElement;

  /**
   * Button for switching display size.
   */
  sizeButton: HTMLButtonElement;
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
   * Observes wrapper size changes to keep display-size caps based on tool width.
   */
  private resizeObserver?: ResizeObserver;

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
      controls: make('div', [this.CSS.controls]),
      caption: make('div', [this.CSS.input, this.CSS.caption], {
        contentEditable: !this.readOnly,
      }),
      alignButton: this.createAlignButton(),
      sizeButton: this.createSizeButton(),
    };

    /**
     * Create base structure
     *  <wrapper>
     *    <figure>
     *      <image-container>
     *        <image-preloader />
     *      </image-container>
     *      <controls>
     *        <align-button />
     *        <caption />
     *        <size-button />
     *      </controls>
     *    </figure>
     *    <select-file-button />
     *  </wrapper>
     */
    this.nodes.caption.dataset.placeholder = this.config.captionPlaceholder;
    this.nodes.imageContainer.appendChild(this.nodes.imagePreloader);
    this.nodes.controls.appendChild(this.nodes.alignButton);
    this.nodes.controls.appendChild(this.nodes.caption);
    this.nodes.controls.appendChild(this.nodes.sizeButton);
    this.nodes.figure.appendChild(this.nodes.imageContainer);
    this.nodes.figure.appendChild(this.nodes.controls);
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
    this.attachResizeObserver();
    this.applyDisplaySizeConstraints();

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
    this.applyDisplaySizeConstraints();
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

      this.applyDisplaySizeConstraints();
    });

    this.nodes.imageContainer.appendChild(this.nodes.imageEl);
    this.applyDisplaySizeConstraints();
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
   * Applies and syncs the current display size selection.
   * @param size - display size value
   */
  public setDisplaySize(size: ImageDisplaySize): void {
    this.nodes.sizeButton.textContent = this.getDisplaySizeLabel(size);
    this.nodes.sizeButton.dataset.size = size;
    this.nodes.sizeButton.title = `图片尺寸: ${this.getDisplaySizeLabel(size)}`;

    const sizes: ImageDisplaySize[] = ['large', 'medium', 'small'];

    sizes.forEach((value) => {
      this.nodes.wrapper.classList.toggle(`${this.CSS.wrapper}--display-size-${value}`, value === size);
    });

    this.applyDisplaySizeConstraints();
  }

  /**
   * Applies and syncs the current alignment selection.
   * @param alignment - image alignment value
   */
  public setAlignment(alignment: ImageAlignment): void {
    this.nodes.alignButton.textContent = this.getAlignmentLabel(alignment);
    this.nodes.alignButton.dataset.alignment = alignment;
    this.nodes.alignButton.title = `Image alignment: ${this.getAlignmentLabel(alignment)}`;

    const alignments: ImageAlignment[] = ['left', 'center', 'right'];

    alignments.forEach((value) => {
      this.nodes.wrapper.classList.toggle(`${this.CSS.wrapper}--align-${value}`, value === alignment);
    });
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
      controls: 'image-tool__controls',
      caption: 'image-tool__caption',
      alignButton: 'image-tool__align-button',
      sizeButton: 'image-tool__size-button',
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

  /**
   * Creates display size button shown near the caption.
   */
  private createSizeButton(): HTMLButtonElement {
    const button = make('button', [this.CSS.sizeButton], {
      type: 'button',
      disabled: this.readOnly,
    }) as HTMLButtonElement;

    button.addEventListener('click', () => {
      const currentSize = (button.dataset.size as ImageDisplaySize | undefined) ?? 'large';
      const nextSize = this.getNextDisplaySize(currentSize);

      this.setDisplaySize(nextSize);
    });

    return button;
  }

  /**
   * Creates alignment button shown near the caption.
   */
  private createAlignButton(): HTMLButtonElement {
    const button = make('button', [this.CSS.alignButton], {
      type: 'button',
      disabled: this.readOnly,
    }) as HTMLButtonElement;

    button.addEventListener('click', () => {
      const currentAlignment = (button.dataset.alignment as ImageAlignment | undefined) ?? 'left';
      const nextAlignment = this.getNextAlignment(currentAlignment);

      this.setAlignment(nextAlignment);
    });

    return button;
  }

  /**
   * Applies display-size caps relative to the tool width instead of the already-scaled image width.
   */
  private applyDisplaySizeConstraints(): void {
    const currentSize = (this.nodes.sizeButton.dataset.size as ImageDisplaySize | undefined) ?? 'large';
    const wrapperWidth = this.nodes.wrapper.getBoundingClientRect().width;

    if (wrapperWidth <= 0) {
      return;
    }

    const ratioMap: Record<ImageDisplaySize, number> = {
      large: 1,
      medium: 0.5,
      small: 0.3,
    };

    const maxWidth = Math.floor(wrapperWidth * ratioMap[currentSize]);

    this.nodes.imageContainer.style.maxWidth = `${maxWidth}px`;
  }

  /**
   * Watches tool width changes so display-size caps stay tied to the current tool width.
   */
  private attachResizeObserver(): void {
    if (this.resizeObserver || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.applyDisplaySizeConstraints();
    });

    this.resizeObserver.observe(this.nodes.wrapper);
  }

  /**
   * Gets compact label for the display size button.
   * @param size - display size value
   */
  private getDisplaySizeLabel(size: ImageDisplaySize): string {
    switch (size) {
      case 'medium':
        return 'M';
      case 'small':
        return 'S';
      case 'large':
      default:
        return 'L';
    }
  }

  /**
   * Gets compact label for the alignment button.
   * @param alignment - image alignment value
   */
  private getAlignmentLabel(alignment: ImageAlignment): string {
    switch (alignment) {
      case 'center':
        return '.';
      case 'right':
        return '>';
      case 'left':
      default:
        return '<';
    }
  }

  /**
   * Cycles to the next display size.
   * @param size - current display size
   */
  private getNextDisplaySize(size: ImageDisplaySize): ImageDisplaySize {
    switch (size) {
      case 'large':
        return 'medium';
      case 'medium':
        return 'small';
      case 'small':
      default:
        return 'large';
    }
  }

  /**
   * Cycles to the next alignment.
   * @param alignment - current alignment
   */
  private getNextAlignment(alignment: ImageAlignment): ImageAlignment {
    switch (alignment) {
      case 'left':
        return 'center';
      case 'center':
        return 'right';
      case 'right':
      default:
        return 'left';
    }
  }
}
