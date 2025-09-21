export { default as ColorUtil } from './ColorUtil.js';
export { default as PUID } from './PUID.js';
export { default as THREEUtil } from './THREEUtil.js';
export { default as Util } from './Util.js';
export { default as uid } from './uid.js';

export const withDefaults = (defaults, properties) => ({
  ...defaults,
  ...properties,
});
