import { EmbeddingInputType } from './embedding-config.types';

export interface EmbedOptions {
  /** Overrides the provider's `defaultInputType` for this call only. */
  inputType?: EmbeddingInputType;
}
