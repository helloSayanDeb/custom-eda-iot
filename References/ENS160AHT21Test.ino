/*
    This is a conglomeration of the DFRobot example sketches for the ENS160 and AHT21 sensors.
    It uses a modified version of the DFRobot DFRobot_ENS160 library that includes an
    alternate begin method to allow 'dynamic' specification of the I2C bus and address
 
    Digital Concepts
    08 Sep 2025
    digitalconcepts.net.au
 */

#include <DFRobot_AHT20.h>
#include <DFRobot_ENS160.h>

/* Remove comment from definitions required for processor platform and interface being used
// Arduino Pro Mini
// I2C - SDA (A4) & SCL (A5) defined in pins_arduino.h
// SPI - MOSI (11), MISO (12) & SCK (13) defined in pins_arduino.h
#define CS		10

// NodeMCU
// I2C - SDA (D2) & SCL (D1) defined in pins_arduino.h
// SPI - MOSI (D7), MISO (D6) & SCK (D5) defined in pins_arduino.h
#define CS		D4
/*
// Heltec CubeCell-Board Plus
// I2C - SDA & SCL defined in pins_arduino.h

// SPI - MOSI1 (GPIO1), MISO1 (GPIO2) & SCK1 (GPIO3) defined in pins_arduino.h
#define SPI   SPI1  // CubeCell-Board Plus uses SPI1
#define CS		GPIO4
*/

DFRobot_AHT20 aht21;

#define I2C_COMMUNICATION  // I2C bus - Comment out this statement to use SPI bus

#ifdef  I2C_COMMUNICATION
  #define ENS160_I2C_Address_1 0x52
  #define ENS160_I2C_Address_2 0x53
  DFRobot_ENS160_I2C ens160;
#else
  DFRobot_ENS160_SPI ens160(&SPI, CS);
#endif


void setup(void)
{
  Serial.begin(115200);
  while (!Serial);
  Serial.println("[setup] Initialising sensors...");
   
  float temperature = 25.0;
  float humidity = 35.0;

  /*
    Ambient temperature and humidity readings, if available, are used to calibrate
    ENS160 air quality measurements
   */

  #ifdef I2C_COMMUNICATION
    Serial.println("[setup] Using I2C bus...");
    #ifdef __ASR_Arduino__
      Wire.begin(SDA,SCL);
    #else 
      Wire.begin();
    #endif

    uint8_t status;
    if ((status = aht21.begin()) != 0) {
      Serial.print("[setup] AHT21 sensor initialization failed. Error status : ");
      Serial.println(status);
    } else {
      Serial.println("[setup] AHT21 sensor found");
    }
    if (aht21.startMeasurementReady(/* crcEn = */true)) {
      temperature = aht21.getTemperature_C();
      Serial.print("[setup] Temperature : ");
      // Get temp in Celsius (°C), range -40-80°C
      Serial.print(temperature);
      Serial.println(" °C");
      // Get temp in Fahrenheit (F)
  //    Serial.print(aht20.getTemperature_F());
  //    Serial.println(" °F");
      // Get relative humidity (%RH), range 0-100%
      humidity = aht21.getHumidity_RH();
      Serial.print("[setup] Humidity    : ");
      Serial.print(humidity);
      Serial.println(" % RH");
    } else {
      Serial.println("[setup] No temperature data available");
      Serial.println("[setup] Using default ambient conditions for calibration...");
      Serial.print("[setup] Temperature : ");
      Serial.print(temperature);
      Serial.println(" °C");
      Serial.print("[setup] Humidity    : ");
      Serial.print(humidity);
      Serial.println(" % RH");
    }

    Serial.println("[setup] Check possible ENS160 sensor addresses...");
    Serial.print("[setup] Try 0x");
    Serial.print(ENS160_I2C_Address_1,HEX);
    Serial.print("...");
    Wire.beginTransmission(ENS160_I2C_Address_1);
    if (Wire.endTransmission() == 0)  {
      Serial.println("sensor found");
      while( NO_ERR != ens160.begin(&Wire, ENS160_I2C_Address_1) ){
        Serial.println("[setup] ENS160 sensor initialisation failed...");
        delay(3000);
      }
    } else {
      Serial.println("no reponse");
      Serial.print("[setup] Try 0x");
      Serial.print(ENS160_I2C_Address_2,HEX);
      Serial.print("...");
      Wire.beginTransmission(ENS160_I2C_Address_2);
      if (Wire.endTransmission() == 0)  {
        Serial.println("sensor found");
        while( NO_ERR != ens160.begin(&Wire, ENS160_I2C_Address_2) ){
          Serial.println("[setup] ENS160 sensor initialisation failed...");
          delay(3000);
        }
      } else {
        Serial.println("no reponse");
        Serial.println( "[setup] Unable to identify ENS160 sensor" );
        while (true);
      }
    }
  #else
    Serial.println("[setup] Using SPI bus...");
    Serial.println("[setup] Using default ambient conditions for calibration...");
    Serial.print("[setup] Temperature : ");
    Serial.print(temperature);
    Serial.println(" °C");
    Serial.print("[setup] Humidity    : ");
    Serial.print(humidity);
    Serial.println(" % RH");
    while( NO_ERR != ens160.begin() ){
      Serial.println("[setup] Failed to initialise ENS160 sensor...");
      delay(3000);
    }
    Serial.println("[setup] ENS160 sensor initialised");
  #endif
  Serial.println("[setup] Set calibration variables...");
  ens160.setTempAndHum(temperature, humidity);

  /*
    Set Power Mode
    ENS160_SLEEP_MODE    : DEEP SLEEP mode (low power standby)
    ENS160_IDLE_MODE     : IDLE mode (low-power)
    ENS160_STANDARD_MODE : STANDARD Gas Sensing Modes
   */
  Serial.println("[setup] Set Power Mode...");
  ens160.setPWRMode(ENS160_STANDARD_MODE);

  Serial.println("[setup] Initialisation complete");
  Serial.println();
}

void loop()
{
  /*
    Get the Sensor Operating Status
    Return value: 0 - Normal operation, 
                  1 - Warm-Up phase, first 3 minutes after power-on.
                  2 - Initial Start-Up phase, first full hour of operation after initial power-on. Only once in the sensor’s lifetime.
    Note: The status will only be stored in the non-volatile memory after an initial 24h of continuous
          operation. If unpowered before conclusion of said period, the ENS160 will resume "Initial Start-up" mode
          after re-powering.
   */
  uint8_t Status = ens160.getENS160Status();
  Serial.print("[loop] Sensor Operating Status : ");
  Serial.println(Status);

  /*
    Get the Air Quality Index
    Return value: 1 - Excellent
                  2 - Good
                  3 - Moderate
                  4 - Poor
                  5 - Unhealthy
   */
  uint8_t AQI = ens160.getAQI();
  Serial.print("[loop]       Air Quality Index : ");
  Serial.println(AQI);

  /*
    Get Total Volatile Organic Compound (TVOC) concentration
    Return value range: 0–65000, unit: ppb
   */
  uint16_t TVOC = ens160.getTVOC();
  Serial.print("[loop]                    TVOC : ");
  Serial.print(TVOC);
  Serial.println(" ppb");

  /*
    Get CO2 equivalent concentration calculated according to the detected data of VOCs and hydrogen (eCO2 – Equivalent CO2)
    Return value range: 400–65000, unit: ppm
    Five levels:  Excellent ( 400 -  600)
                  Good      ( 600 -  800)
                  Moderate  ( 800 - 1000)
                  Poor      (1000 - 1500)
                  Unhealthy (     > 1500)
   */
  uint16_t ECO2 = ens160.getECO2();
  Serial.print("[loop]                    eCO2 : ");
  Serial.print(ECO2);
  Serial.println(" ppm");

  Serial.println();
  delay(5000);
}
