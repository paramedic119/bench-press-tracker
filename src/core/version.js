/**
 * アプリのバージョン。ビルド時に package.json の値が __APP_VERSION__ として埋め込まれる。
 * 素の node（ユニットテスト）から読んだときは 'dev' になる。
 */
/* global __APP_VERSION__ */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
