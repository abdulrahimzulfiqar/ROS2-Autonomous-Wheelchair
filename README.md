# ROS 2 Autonomous Smart Wheelchair ♿🤖

<div align="center">
  <!-- TODO: Add a GIF or Image of the wheelchair moving or the smart dashboard here! -->
  <img src="https://via.placeholder.com/800x400?text=Autonomous+Wheelchair+Demo+GIF+Goes+Here" alt="Smart Wheelchair Demo" width="800"/>
</div>

An end-to-end **Autonomous Smart Wheelchair** powered by ROS 2 (Humble), Raspberry Pi 4, and 2D LiDAR. 

This assistive technology project features room-to-room predictive navigation, real-time hardware fall detection, and a React-based Web Dashboard allowing the user to control the chair entirely with their voice, while Caregivers can track the chair remotely.

---

## ✨ Key Features
- **Predictive Autonomous Navigation**: Powered by the official ROS 2 `Nav2` stack and Google Cartographer for 2D Simultaneous Localization and Mapping (SLAM).
- **Remote Telemetry Dashboard**: A React + Vite web application synced in real-time via Google Firebase to track the wheelchair's location globally.
- **Mobile Voice Control**: Utter commands like *"Wheelchair, go to Kitchen"* directly from your phone using the Web Speech API.
- **Emergency Logging & Fall Detection**: Hardware-level MPU6050 tip-over detection that instantly publishes alerts directly to the Caregiver's database log.

## 🧠 Architecture Approach: Why 2D LiDAR over 3D Vision?
A common question from recruiters is why we relied on purely 2D LiDAR instead of a Camera-only (V-SLAM) pipeline like Tesla Vision.

Processing dense computer vision at 30 FPS requires a dedicated hardware GPU tensor (like an Nvidia Jetson Orin). Running real-time Vision processing on a Raspberry Pi 4 alongside the ROS 2 Navigation stack would max out the CPU, causing massive latency. The RPLidar A1 is a brilliant engineering tradeoff because it offloads the dense mapping by computing precise millimeter point clouds natively on its own spinning hardware, routing lightweight arrays over USB. This allows the Pi to navigate perfectly with ultra-low compute overhead.

---

## 🛠️ Hardware & Components

### Parts List
| Component | Voltage | Current | Key Notes |
| :--- | :--- | :--- | :--- |
| **JGA25-370 Motors (x2)** | 12V DC | 0.04-2A each | 11 PPR encoder, 21.3:1 ratio, 280 RPM |
| **Raspberry Pi 4B** | 5V DC | 3A minimum | 4GB RAM, runs ROS2 Humble (Main Brain) |
| **Arduino Uno R3** | USB Powered | ~500mA | Motor control, PID, & encoder reading |
| **L298N Motor Driver**| 12V Supply | Up to 2A per motor| Dual H-Bridge |
| **RPLidar A1** | 5V DC | 100mA | 360° laser scanner, USB UART interface |
| **MPU6050 IMU** | 3.3V DC | ~3.5mA | Gyro + Accel for Fall Detection |
| **18650 Cells (x3)** | 11.1V (3S) | Capacity varies | Powers the motors |

### 🧑‍🔧 Building the Robot (Layman's Guide)
If you are new to robotics, do not be intimidated! Follow this plain-English sequence to wire up the hardware safely.

*⚠️ **CRUCIAL RULE**: You MUST connect ALL ground wires (the black ones) from the Battery, Motor Driver, and Arduino together into a single joined circuit so the electricity can flow perfectly.*

**Step 1: Powering the Motors**
Grab your large 11.1V battery. Connect the Red wire (+) to the `12V` terminal on the L298N driver. Connect the Black wire (-) to the `GND` terminal. *This ensures the heavy motors get power without blowing up the sensitive computer brains.*

**Step 2: Connecting the Wheels (Motors to Driver)**
Take your left motor's Red and White wires and plug them into the `OUT1` and `OUT2` terminals on the L298N block. Plug the right motor's Red and White wires into `OUT3` and `OUT4`.

**Step 3: Powering the Brains (Raspberry Pi & Arduino)**
Plug your standard 5V/3A battery pack (like a cell phone charger block) into the Raspberry Pi's USB-C port. Then, use a standard blue USB cable bridging the Raspberry Pi to the Arduino. This single wire automatically powers the Arduino *and* allows the Pi to send driving commands to it!

**Step 4: Connecting the Sensors**
- **Lidar:** Plug the RPLidar straight into the Raspberry Pi's USB port.
- **Speed Sensors (Encoders):** Connect the Left Motor's Yellow and Green wires to Arduino pins `2` and `4`. Connect the Right Motor to `3` and `5`. 
- **Fall Detector (MPU6050):** Wire `VCC` to Arduino `3.3V`, `GND` to `GND`, `SDA` to pin `A4`, and `SCL` to `A5`.

**Step 5: Driving the Motors (Arduino to L298N)**
Finally, connect the command wires so the Arduino can speed up the wheels. Remove the black jumpers on `ENA/ENB` first! Hook `ENA` ➔ Pin `6`, `IN1` ➔ `7`, `IN2` ➔ `8`, `ENB` ➔ `11`, `IN3` ➔ `12`, and `IN4` ➔ `13`.

---

## 💻 Software Architecture & Installation

```mermaid
graph TD;
    PCC[PC Command Centre / React App] <-->|WebSockets & Firebase| Pi[Robot Raspberry Pi]
    Lidar[RPLidar A1] -->|USB Scan Data| Pi
    Pi <-->|Serial Communication| Arduino[Arduino Uno]
    Arduino -->|PWM Signals| Driver[L298N Motor Driver]
    Driver --> Motor1[Motor 1]
    Driver --> Motor2[Motor 2]
    Motor1 -->|Encoder Ticks| Arduino
    Motor2 -->|Encoder Ticks| Arduino
```

### 1. Firmware & Microcontroller Setup
Before starting the heavy Linux computers, you must flash the low-level C++ firmware to the Arduino to handle the real-time motors and IMU balancing.
1. Connect the **Arduino Uno** to your PC via USB.
2. Open the `arduino_bridge.ino` file using the Arduino IDE.
3. Select your COM port and board (Arduino Uno), then click **Upload**.
4. *(Optional)* Upload `calibration.ino` if you need to manually test the tip-over limits of the MPU6050 fall-detector.

### 2. Raspberry Pi Setup (ROS 2)
1. Install **Ubuntu 22.04 Server** on the Raspberry Pi.
2. Install **ROS 2 Humble**.
3. Build the workspace:
```bash
mkdir -p ~/wheelchair_ws/src
cd ~/wheelchair_ws/src
git clone <THIS-REPO-URL>
cd ~/wheelchair_ws
colcon build --symlink-install
source install/setup.bash
```

### 3. Web App Dashboard Setup
Inside the `/web_app` folder of this repo:
```bash
npm install
npm run dev
```
**Security Note:** Create a `.env` file in your `web_app` directory containing your strict Firebase Config limits. Never commit it to GitHub. Ask a caregiver to provision your credentials!

### 4. 🗺️ Map Visualization & Foxglove Studio
To plan navigation waypoints visually or view the physical mapping structure created by the Lidar, we use **Foxglove Studio**.
1. Download Foxglove Studio on your PC Command Centre.
2. Open a *Rosbridge WebSockets* data connection targeting `ws://<YOUR_PI_IP>:9090`.
3. Add a **3D Panel** and subscribe to `/map`, `/scan`, and `/tf` to view the live generated SLAM trajectory.
4. Hover over the Foxglove map to read exact `X` and `Y` telemetry coordinates. Caregivers input those precise numbers into the React Web App to permanently save distinct destinations (like "Kitchen")!

<div align="center">
  <!-- TODO: Add Screenshot of Foxglove Studio Map Navigation Here -->
  <img src="https://via.placeholder.com/800x400?text=Foxglove+Studio+Navigation+Map+Screenshot+Here" alt="Foxglove Navigation Demo" width="800"/>
</div>

---

## 🧗‍♂️ Challenges & Lessons Learned
Recruiters: Here are a few distributed system bugs we solved to get this working!

- **WebSockets on Mobile Security Restrictions**: Mobile Chrome instantly blocks microphone access (Web Speech API) on standard HTTP network addresses. We securely bypassed this by converting the Vite dev server to HTTPS and writing a custom dynamic `wss://` proxy to tunnel the unencrypted ROS WebSockets securely.
- **Distributed State Duplication**: If multiple caregivers (Laptop + Phone) open the dashboard, a single ROS emergency broadcast triggers multiple simultaneous Firebase DB writes. We solved this distributed systems bug by moving from random `addDoc` IDs to deterministic `setDoc` overwrite keys, combined with a 3-second hardware `rclpy` cooldown timer!
- **Zero-Latency Telemetry Math**: Instead of relying on slow, bandwidth-heavy terminal log subscriptions to track when a goal is reached, we hooked our UI directly into the `nav_msgs/Odometry` stream and built a custom Euclidean distance calculation algorithm that efficiently tracks physical arrivals in real-time.

---

## 🚧 Limitations & Future Scope
- **2D Plane Constraint**: The RPLidar A1 only scans a 2D slice at knee-height. It cannot detect dynamic 3D obstacles like an overhanging table corner or dropped laundry. 
- **Future Improvement:** In a Phase 2 rollout, we plan to shift computation to an Nvidia Jetson Nano and integrate an Intel RealSense Depth Camera to run 3D Voxel grid obstacle avoidance.
