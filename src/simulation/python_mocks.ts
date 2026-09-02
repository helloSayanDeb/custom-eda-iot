// ─────────────────────────────────────────────────────────────────
//  CircuitPython Hardware API Mocks for Pyodide
//
//  Your actual sensors (from block diagram):
//    MAX30102 (0x57), MPU-6050 (0x68), TMP117 (0x48),
//    ENS160 (0x52), AHT21 (0x38), LTR-390 (0x53)
//
//  The real Adafruit drivers (already in public/lib/) are injected
//  directly into Pyodide. These mocks only provide the low-level
//  CircuitPython platform APIs that don't exist in standard Python.
// ─────────────────────────────────────────────────────────────────

// ── board ───────────────────────────────────────────────────────
export const BOARD_MOCK = `
class Pin:
    def __init__(self, id):
        self.id = id
    def __repr__(self):
        return f"Pin({self.id})"

SCL = Pin("SCL")
SDA = Pin("SDA")
D0 = Pin("D0")
D1 = Pin("D1")
D2 = Pin("D2")
D3 = Pin("D3")
D4 = Pin("D4")
D5 = Pin("D5")
D6 = Pin("D6")
D7 = Pin("D7")
D8 = Pin("D8")
D9 = Pin("D9")
D10 = Pin("D10")
A0 = Pin("A0")
A1 = Pin("A1")
A2 = Pin("A2")
A3 = Pin("A3")
BAT_VOLT = Pin("BAT_VOLT")
TX = Pin("TX")
RX = Pin("RX")
MISO = Pin("MISO")
MOSI = Pin("MOSI")
SCK = Pin("SCK")

def I2C():
    """board.I2C() convenience — returns a busio.I2C using board pins."""
    import busio
    return busio.I2C(SCL, SDA)

def SPI():
    pass

def UART():
    pass
`;

// ── busio ───────────────────────────────────────────────────────
export const BUSIO_MOCK = `
import js

class I2C:
    def __init__(self, scl, sda, frequency=100000):
        self.scl = scl
        self.sda = sda
        self.frequency = frequency
        self._locked = False

    def init(self, scl, sda, frequency):
        pass

    def deinit(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.deinit()

    def try_lock(self):
        if self._locked:
            return False
        self._locked = True
        return True

    def unlock(self):
        self._locked = False

    def readfrom_into(self, address, buffer, *, start=0, end=None):
        if end is None:
            end = len(buffer)
        length = end - start
        js_data = js.simI2CRead(address, length)
        for i in range(length):
            buffer[start + i] = js_data[i]

    def writeto(self, address, buffer, *, start=0, end=None, stop=True):
        if end is None:
            end = len(buffer)
        data = bytes(buffer[start:end])
        js.simI2CWrite(address, data)

    def writeto_then_readfrom(self, address, out_buffer, in_buffer, *, out_start=0, out_end=None, in_start=0, in_end=None):
        if out_end is None:
            out_end = len(out_buffer)
        if in_end is None:
            in_end = len(in_buffer)
        self.writeto(address, out_buffer, start=out_start, end=out_end)
        self.readfrom_into(address, in_buffer, start=in_start, end=in_end)

    def scan(self):
        return [0x38, 0x48, 0x52, 0x53, 0x57, 0x68]
`;

// ── digitalio ───────────────────────────────────────────────────
export const DIGITALIO_MOCK = `
class Direction:
    INPUT = 0
    OUTPUT = 1

class Pull:
    UP = 0
    DOWN = 1

class DriveMode:
    PUSH_PULL = 0
    OPEN_DRAIN = 1

class DigitalInOut:
    def __init__(self, pin):
        self.pin = pin
        self.direction = Direction.INPUT
        self.value = True
        self.drive_mode = DriveMode.PUSH_PULL
        self.pull = None

    def deinit(self):
        pass

    def switch_to_output(self, value=False, drive_mode=DriveMode.PUSH_PULL):
        self.direction = Direction.OUTPUT
        self.value = value
        self.drive_mode = drive_mode

    def switch_to_input(self, pull=None):
        self.direction = Direction.INPUT
        self.pull = pull
`;

// ── analogio ────────────────────────────────────────────────────
export const ANALOGIO_MOCK = `
class AnalogIn:
    def __init__(self, pin):
        self.pin = pin
        self._raw = 38000

    @property
    def value(self):
        return self._raw

    @property
    def reference_voltage(self):
        return 3.3

    def deinit(self):
        pass
`;

// ── supervisor ──────────────────────────────────────────────────
export const SUPERVISOR_MOCK = `
class _Runtime:
    usb_connected = True
    serial_connected = True

runtime = _Runtime()
`;

// ── microcontroller ─────────────────────────────────────────────
export const MICROCONTROLLER_MOCK = `
class Pin:
    pass

def reset():
    print("[SIM] microcontroller.reset() called")
    raise SystemExit("microcontroller.reset()")

class _NVM:
    def __getitem__(self, key):
        return 0
    def __setitem__(self, key, val):
        pass

nvm = _NVM()
cpu = type("cpu", (), {"frequency": 64000000, "temperature": 25.0})()
`;

// ── time ────────────────────────────────────────────────────────
export const TIME_MOCK = `
import js

def sleep(seconds):
    js.simSleep(seconds)

def monotonic():
    return js.performance.now() / 1000.0

def monotonic_ns():
    return int(js.performance.now() * 1_000_000)

class struct_time:
    def __init__(self, tm_year=2026, tm_mon=1, tm_mday=1,
                 tm_hour=0, tm_min=0, tm_sec=0,
                 tm_wday=0, tm_yday=1, tm_isdst=-1):
        self.tm_year = tm_year
        self.tm_mon = tm_mon
        self.tm_mday = tm_mday
        self.tm_hour = tm_hour
        self.tm_min = tm_min
        self.tm_sec = tm_sec
        self.tm_wday = tm_wday
        self.tm_yday = tm_yday
        self.tm_isdst = tm_isdst

def localtime(secs=None):
    return struct_time()
`;

// ── micropython (needed by all Adafruit drivers) ────────────────
export const MICROPYTHON_MOCK = `
def const(x):
    return x

def native(f):
    return f

def viper(f):
    return f
`;

// ── circuitpython_typing (optional typing stubs) ────────────────
export const CIRCUITPYTHON_TYPING_MOCK = `
import sys
class _device_drivers:
    class I2CDeviceDriver: pass
sys.modules['circuitpython_typing.device_drivers'] = _device_drivers

ReadableBuffer = bytes
WriteableBuffer = bytearray
`;

// ── adafruit_ble/__init__.py ────────────────────────────────────
export const ADAFRUIT_BLE_INIT_MOCK = `
class BLERadio:
    def __init__(self):
        self.name = "MockBLE"
        self._connected = False
        self._advertising = False

    @property
    def connected(self):
        return self._connected

    def start_advertising(self, advertisement, **kwargs):
        self._advertising = True
        print("[BLE] Advertising started as:", self.name)

    def stop_advertising(self):
        self._advertising = False
        print("[BLE] Advertising stopped")
`;

// ── adafruit_ble/advertising/__init__.py ────────────────────────
export const ADAFRUIT_BLE_ADV_INIT_MOCK = `
class Advertisement:
    pass
`;

// ── adafruit_ble/advertising/standard.py ────────────────────────
export const ADAFRUIT_BLE_ADV_STANDARD_MOCK = `
class ProvideServicesAdvertisement:
    def __init__(self, *services):
        self.services = services
`;

// ── adafruit_ble/services/__init__.py ───────────────────────────
export const ADAFRUIT_BLE_SERVICES_INIT_MOCK = `
class Service:
    pass
`;

// ── adafruit_ble/services/nordic.py ─────────────────────────────
export const ADAFRUIT_BLE_SERVICES_NORDIC_MOCK = `
class UARTService:
    def __init__(self):
        self._rx_buf = b""
        self._in_waiting = 0

    @property
    def in_waiting(self):
        return self._in_waiting

    def read(self, nbytes=None):
        data = self._rx_buf
        self._rx_buf = b""
        self._in_waiting = 0
        return data

    def write(self, data):
        if isinstance(data, str):
            data = data.encode()
        try:
            text = data.decode("utf-8", "ignore")
            if text.strip():
                print("[BLE TX]", text.strip())
        except Exception:
            pass

    def readline(self):
        return self.read()
`;

// ── adafruit_mpu6050.py (shim that uses our I2C mock) ───────────
export const ADAFRUIT_MPU6050_MOCK = `
import struct

class MPU6050:
    """Mock MPU6050 driver — reads registers from our JS I2C mock."""

    WHO_AM_I_REG = 0x75
    ACCEL_OUT = 0x3B
    GYRO_OUT = 0x43
    PWR_MGMT_1 = 0x6B

    def __init__(self, i2c, address=0x68):
        self._i2c = i2c
        self._address = address

        # Verify WHO_AM_I
        who = self._read_byte(0x75)
        if who != 0x68:
            raise RuntimeError(f"MPU6050 WHO_AM_I mismatch: 0x{who:02X}")
        # Wake up (clear sleep bit)
        self._write_byte(0x6B, 0x00)
        print(f"MPU6050 initialized at 0x{address:02X}")

    def _read_byte(self, reg):
        while not self._i2c.try_lock():
            pass
        try:
            buf = bytearray(1)
            self._i2c.writeto_then_readfrom(self._address, bytes([reg]), buf)
            return buf[0]
        finally:
            self._i2c.unlock()

    def _read_bytes(self, reg, length):
        while not self._i2c.try_lock():
            pass
        try:
            buf = bytearray(length)
            self._i2c.writeto_then_readfrom(self._address, bytes([reg]), buf)
            return buf
        finally:
            self._i2c.unlock()

    def _write_byte(self, reg, val):
        while not self._i2c.try_lock():
            pass
        try:
            self._i2c.writeto(self._address, bytes([reg, val]))
        finally:
            self._i2c.unlock()

    @property
    def acceleration(self):
        """Returns (ax, ay, az) in m/s^2."""
        data = self._read_bytes(self.ACCEL_OUT, 6)
        x = struct.unpack(">h", data[0:2])[0] / 16384.0 * 9.80665
        y = struct.unpack(">h", data[2:4])[0] / 16384.0 * 9.80665
        z = struct.unpack(">h", data[4:6])[0] / 16384.0 * 9.80665
        return (round(x, 4), round(y, 4), round(z, 4))

    @property
    def gyro(self):
        """Returns (gx, gy, gz) in deg/s."""
        data = self._read_bytes(self.GYRO_OUT, 6)
        x = struct.unpack(">h", data[0:2])[0] / 131.0
        y = struct.unpack(">h", data[2:4])[0] / 131.0
        z = struct.unpack(">h", data[4:6])[0] / 131.0
        return (round(x, 4), round(y, 4), round(z, 4))

    @property
    def temperature(self):
        data = self._read_bytes(0x41, 2)
        raw = struct.unpack(">h", data)[0]
        return round(raw / 340.0 + 36.53, 2)
`;

// ── adafruit_tmp117.py (shim that uses our I2C mock) ────────────
export const ADAFRUIT_TMP117_MOCK = `
import struct

class TMP117:
    def __init__(self, i2c, address=0x48):
        self._i2c = i2c
        self._address = address
        self.low_limit = -40
        self.high_limit = 150
        print(f"TMP117 initialized at 0x{address:02X}")

    def _read_word(self, reg):
        while not self._i2c.try_lock():
            pass
        try:
            buf = bytearray(2)
            self._i2c.writeto_then_readfrom(self._address, bytes([reg]), buf)
            return struct.unpack(">h", buf)[0]
        finally:
            self._i2c.unlock()

    @property
    def temperature(self):
        raw = self._read_word(0x00)
        return round(raw * 0.0078125, 2)
`;
