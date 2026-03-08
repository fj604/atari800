#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source /workspace/emsdk/emsdk_env.sh >/dev/null
cd "$ROOT"
autoreconf -fi >/dev/null
emconfigure ./configure --with-video=sdl2 --with-sound=sdl2 --disable-netsio --disable-riodevice --disable-rnetwork --disable-rserial --without-opengl >/dev/null
emmake make -j"$(nproc)" >/dev/null
mkdir -p web/dist
cd src
emcc -O2 -o "$ROOT/web/dist/atari800.html" \
  atari800-afile.o atari800-antic.o atari800-atari.o atari800-binload.o atari800-cartridge.o atari800-cartridge_info.o atari800-cassette.o atari800-compfile.o atari800-cfg.o atari800-cpu.o atari800-crc32.o atari800-devices.o atari800-esc.o atari800-gtia.o atari800-img_tape.o atari800-log.o atari800-memory.o atari800-monitor.o atari800-pbi.o atari800-pia.o atari800-pokey.o roms/atari800-altirra_5200_os.o roms/atari800-altirra_5200_charset.o atari800-rtime.o atari800-sio.o atari800-sysrom.o atari800-util.o sdl/atari800-init.o atari800-pokeysnd.o atari800-mzpokeysnd.o atari800-remez.o atari800-sound.o sdl/atari800-sound.o atari800-pokeyrec.o codecs/atari800-image.o codecs/atari800-image_pcx.o atari800-file_export.o codecs/atari800-container.o codecs/atari800-container_wav.o codecs/atari800-audio.o codecs/atari800-audio_pcm.o codecs/atari800-audio_adpcm.o codecs/atari800-audio_mulaw.o codecs/atari800-container_avi.o codecs/atari800-video.o codecs/atari800-video_mrle.o codecs/atari800-video_zmbv.o atari800-videomode.o sdl/atari800-main.o sdl/atari800-video.o sdl/atari800-video_sw.o sdl/atari800-input.o sdl/atari800-palette.o atari800-pbi_proto80.o atari800-af80.o atari800-bit3.o atari800-input.o atari800-statesav.o atari800-ui_basic.o atari800-ui.o atari800-artifact.o atari800-colours.o atari800-colours_ntsc.o atari800-colours_pal.o atari800-colours_external.o atari800-screen.o atari800-cycle_map.o roms/atari800-altirraos_800.o roms/atari800-altirraos_xl.o roms/atari800-altirra_basic.o atari800-pbi_mio.o atari800-pbi_bb.o atari800-pbi_scsi.o atari800-pbi_xld.o atari800-voicebox.o atari800-votrax.o atari800-votraxsnd.o atari800-ide.o sdl/atari800-video_gl.o atari800-xep80.o atari800-xep80_fonts.o atari800-filter_ntsc.o atari_ntsc/atari800-atari_ntsc.o atari800-pal_blending.o \
  -lm -sUSE_SDL=2 --shell-file "$ROOT/web/shell.html" --pre-js "$ROOT/web/pre.js" \
  -sALLOW_MEMORY_GROWTH=1 -sASSERTIONS=1 -sEXPORTED_RUNTIME_METHODS=FS,ccall,cwrap -lidbfs.js
cd "$ROOT"
cp web/app.css web/app.js web/dist/
