#include <stdio.h>
#include <string.h>
#include <errno.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <unistd.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

#include "libatari800/libatari800.h"
#include "screen.h"
#include "colours.h"
#include "atari.h"

#define WEB_SCREEN_PIXELS (Screen_WIDTH * Screen_HEIGHT)
#define WEB_RGBA_BYTES (WEB_SCREEN_PIXELS * 4)

static input_template_t g_input;
static emulator_state_t g_state;
static unsigned char g_rgba[WEB_RGBA_BYTES];

static void web_zero_input(void) {
	libatari800_clear_input_array(&g_input);
	g_input.joy0 = 15;
	g_input.joy1 = 15;
	g_input.joy2 = 15;
	g_input.joy3 = 15;
}

EMSCRIPTEN_KEEPALIVE
int web_atari800_init(void) {
	char *argv[] = {
		"atari800",
		"-config", "/userdata/atari800.cfg",
		"-atari_files", "/userdata/roms",
		"-saved_files", "/userdata/saves",
		NULL
	};
	web_zero_input();
	return libatari800_init(-1, argv);
}

EMSCRIPTEN_KEEPALIVE
int web_atari800_frame(void) {
	return libatari800_next_frame(&g_input);
}

EMSCRIPTEN_KEEPALIVE
void web_atari800_input_begin(void) {
	unsigned char joy0 = g_input.joy0;
	unsigned char joy1 = g_input.joy1;
	unsigned char joy2 = g_input.joy2;
	unsigned char joy3 = g_input.joy3;
	unsigned char trig0 = g_input.trig0;
	unsigned char trig1 = g_input.trig1;
	unsigned char trig2 = g_input.trig2;
	unsigned char trig3 = g_input.trig3;
	web_zero_input();
	g_input.joy0 = joy0;
	g_input.joy1 = joy1;
	g_input.joy2 = joy2;
	g_input.joy3 = joy3;
	g_input.trig0 = trig0;
	g_input.trig1 = trig1;
	g_input.trig2 = trig2;
	g_input.trig3 = trig3;
}

EMSCRIPTEN_KEEPALIVE
void web_atari800_set_keychar(int keychar) { g_input.keychar = (unsigned char) keychar; }
EMSCRIPTEN_KEEPALIVE
void web_atari800_set_keycode(int keycode) { g_input.keycode = (unsigned char) keycode; }
EMSCRIPTEN_KEEPALIVE
void web_atari800_set_special(int special) { g_input.special = (unsigned char) special; }
EMSCRIPTEN_KEEPALIVE
void web_atari800_set_shift(int shift) { g_input.shift = (unsigned char) !!shift; }
EMSCRIPTEN_KEEPALIVE
void web_atari800_set_control(int control) { g_input.control = (unsigned char) !!control; }
EMSCRIPTEN_KEEPALIVE
void web_atari800_set_console_keys(int start, int select, int option) {
	g_input.start = (unsigned char) !!start;
	g_input.select = (unsigned char) !!select;
	g_input.option = (unsigned char) !!option;
}
EMSCRIPTEN_KEEPALIVE
void web_atari800_set_joystick(int port, int nibble, int trigger) {
	unsigned char value = (unsigned char) (nibble & 0x0f);
	unsigned char trig = (unsigned char) !!trigger;
	switch (port) {
		case 0: g_input.joy0 = value; g_input.trig0 = trig; break;
		case 1: g_input.joy1 = value; g_input.trig1 = trig; break;
		case 2: g_input.joy2 = value; g_input.trig2 = trig; break;
		case 3: g_input.joy3 = value; g_input.trig3 = trig; break;
		default: break;
	}
}

EMSCRIPTEN_KEEPALIVE
unsigned char *web_atari800_get_rgba_ptr(void) {
	unsigned char *source = (unsigned char *) libatari800_get_screen_ptr();
	for (int i = 0; i < WEB_SCREEN_PIXELS; ++i) {
		int rgb = Colours_table[source[i]];
		g_rgba[(i * 4) + 0] = (unsigned char) ((rgb >> 16) & 0xff);
		g_rgba[(i * 4) + 1] = (unsigned char) ((rgb >> 8) & 0xff);
		g_rgba[(i * 4) + 2] = (unsigned char) (rgb & 0xff);
		g_rgba[(i * 4) + 3] = 0xff;
	}
	return g_rgba;
}

EMSCRIPTEN_KEEPALIVE
int web_atari800_get_width(void) { return Screen_WIDTH; }
EMSCRIPTEN_KEEPALIVE
int web_atari800_get_height(void) { return Screen_HEIGHT; }

EMSCRIPTEN_KEEPALIVE
int web_atari800_reboot_with_file(const char *path) {
	return libatari800_reboot_with_file(path);
}

EMSCRIPTEN_KEEPALIVE
int web_atari800_mount_disk(int drive, const char *path, int readonly) {
	return libatari800_mount_disk(drive, path, readonly);
}

EMSCRIPTEN_KEEPALIVE
void web_atari800_warm_reset(void) { Atari800_Warmstart(); }
EMSCRIPTEN_KEEPALIVE
void web_atari800_cold_reset(void) { Atari800_Coldstart(); }

EMSCRIPTEN_KEEPALIVE
int web_atari800_save_state(const char *path) {
	FILE *f;
	libatari800_get_current_state(&g_state);
	f = fopen(path, "wb");
	if (f == NULL) return 0;
	if (fwrite(&g_state, 1, sizeof(g_state), f) != sizeof(g_state)) {
		fclose(f);
		return 0;
	}
	fclose(f);
	return 1;
}

EMSCRIPTEN_KEEPALIVE
int web_atari800_load_state(const char *path) {
	FILE *f = fopen(path, "rb");
	if (f == NULL) return 0;
	if (fread(&g_state, 1, sizeof(g_state), f) != sizeof(g_state)) {
		fclose(f);
		return 0;
	}
	fclose(f);
	libatari800_restore_state(&g_state);
	return 1;
}

EMSCRIPTEN_KEEPALIVE
const char *web_atari800_last_error(void) {
	return libatari800_error_message();
}

EMSCRIPTEN_KEEPALIVE
int web_fs_ensure_dir(const char *path) {
	int rc = mkdir(path, 0777);
	if (rc == 0 || errno == EEXIST) {
		return 1;
	}
	return 0;
}
