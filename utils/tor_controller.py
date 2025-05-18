import time
import logging
import threading
import subprocess
import socket
import os
import signal
import stem
import stem.control
import stem.process
import schedule
import requests
import random
from stem import Signal
from stem.control import Controller

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TorController:
    def __init__(self, tor_port=9050, control_port=9051, password=None):
        self.tor_port = tor_port
        self.control_port = control_port
        self.password = password or self._generate_password()
        self.tor_process = None
        self.is_running = False
        self.rotation_interval = 10  # seconds
        self.rotation_thread = None
        self.stop_event = threading.Event()
        self.last_ip = None
        self.rotation_count = 0
        self.tor_data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tor_data')
        
        # Create tor data directory if it doesn't exist
        if not os.path.exists(self.tor_data_dir):
            os.makedirs(self.tor_data_dir)
    
    def _generate_password(self):
        """Generate a random password for Tor control authentication"""
        return ''.join(random.choice('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') for _ in range(16))
    
    def _get_tor_config(self):
        """Generate Tor configuration"""
        return {
            'SocksPort': str(self.tor_port),
            'ControlPort': str(self.control_port),
            'DataDirectory': self.tor_data_dir,
            'HashedControlPassword': self._get_hashed_password(),
            'CookieAuthentication': '0',
            'ExitRelay': '0',
            'MaxCircuitDirtiness': '10',  # Force circuit rotation every 10 seconds
            'CircuitBuildTimeout': '5',
            'NumEntryGuards': '8',
            'KeepalivePeriod': '60',
            'NewCircuitPeriod': '10',
        }
    
    def _get_hashed_password(self):
        """Get the hashed password for Tor control authentication"""
        tor_path = self._find_tor_executable()
        if not tor_path:
            raise Exception("Tor executable not found. Please install Tor.")
        
        try:
            result = subprocess.run(
                [tor_path, '--hash-password', self.password],
                capture_output=True,
                text=True,
                check=True
            )
            hashed_password = result.stdout.strip()
            return hashed_password
        except subprocess.CalledProcessError as e:
            logger.error(f"Error generating hashed password: {e}")
            raise
    
    def _find_tor_executable(self):
        """Find the Tor executable path"""
        possible_paths = [
            'tor',
            '/usr/bin/tor',
            '/usr/local/bin/tor',
            'C:\\Tor\\tor.exe',
            'C:\\Program Files\\Tor\\tor.exe',
            'C:\\Program Files (x86)\\Tor\\tor.exe'
        ]
        
        for path in possible_paths:
            try:
                subprocess.run([path, '--version'], capture_output=True, check=True)
                return path
            except (subprocess.CalledProcessError, FileNotFoundError):
                continue
        
        return None
    
    def start_tor(self):
        """Start the Tor process"""
        if self.is_running:
            logger.info("Tor is already running")
            return
        
        tor_path = self._find_tor_executable()
        if not tor_path:
            raise Exception("Tor executable not found. Please install Tor.")
        
        logger.info("Starting Tor process...")
        
        try:
            # Start Tor as a subprocess
            config = self._get_tor_config()
            cmd = [tor_path]
            for key, value in config.items():
                cmd.extend([f'--{key}', value])
            
            self.tor_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Wait for Tor to start
            time.sleep(5)
            
            # Check if Tor is running
            if self.tor_process.poll() is not None:
                stderr = self.tor_process.stderr.read()
                raise Exception(f"Failed to start Tor: {stderr}")
            
            self.is_running = True
            logger.info("Tor process started successfully")
            
            # Start IP rotation in a separate thread
            self.start_ip_rotation()
            
            return True
        except Exception as e:
            logger.error(f"Error starting Tor: {e}")
            if self.tor_process:
                self.tor_process.terminate()
                self.tor_process = None
            raise
    
    def stop_tor(self):
        """Stop the Tor process"""
        if not self.is_running:
            logger.info("Tor is not running")
            return
        
        logger.info("Stopping Tor process...")
        
        # Stop IP rotation thread
        self.stop_ip_rotation()
        
        # Terminate Tor process
        if self.tor_process:
            self.tor_process.terminate()
            try:
                self.tor_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.tor_process.kill()
            self.tor_process = None
        
        self.is_running = False
        logger.info("Tor process stopped")
    
    def renew_tor_ip(self):
        """Request a new Tor circuit and IP address"""
        try:
            with Controller.from_port(port=self.control_port) as controller:
                controller.authenticate(password=self.password)
                controller.signal(Signal.NEWNYM)
                
                # Wait for the new circuit to be established
                time.sleep(2)
                
                # Get the new IP address
                new_ip = self.get_current_ip()
                if new_ip != self.last_ip:
                    self.rotation_count += 1
                    logger.info(f"Tor IP rotated ({self.rotation_count}): {new_ip}")
                    self.last_ip = new_ip
                else:
                    logger.warning("IP rotation did not change the IP address")
                
                return new_ip
        except stem.SocketError as e:
            logger.error(f"Error connecting to Tor control port: {e}")
            return None
        except stem.connection.AuthenticationFailure as e:
            logger.error(f"Authentication failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Error renewing Tor IP: {e}")
            return None
    
    def get_current_ip(self):
        """Get the current IP address through Tor"""
        try:
            proxies = {
                'http': f'socks5h://127.0.0.1:{self.tor_port}',
                'https': f'socks5h://127.0.0.1:{self.tor_port}'
            }
            
            # Use a service that returns your IP address
            response = requests.get('https://api.ipify.org', proxies=proxies, timeout=10)
            return response.text.strip()
        except Exception as e:
            logger.error(f"Error getting current IP: {e}")
            return None
    
    def _ip_rotation_job(self):
        """Job to rotate the Tor IP address periodically"""
        if self.stop_event.is_set():
            return schedule.CancelJob
        
        self.renew_tor_ip()
        return schedule.CancelJob  # We'll reschedule it manually
    
    def _ip_rotation_loop(self):
        """Background thread function for IP rotation"""
        logger.info(f"Starting IP rotation every {self.rotation_interval} seconds")
        
        # Get initial IP
        self.last_ip = self.get_current_ip()
        logger.info(f"Initial Tor IP: {self.last_ip}")
        
        while not self.stop_event.is_set():
            # Run the job
            self._ip_rotation_job()
            
            # Sleep for the rotation interval
            for _ in range(self.rotation_interval):
                if self.stop_event.is_set():
                    break
                time.sleep(1)
    
    def start_ip_rotation(self):
        """Start the IP rotation thread"""
        if self.rotation_thread and self.rotation_thread.is_alive():
            logger.info("IP rotation is already running")
            return
        
        self.stop_event.clear()
        self.rotation_thread = threading.Thread(target=self._ip_rotation_loop)
        self.rotation_thread.daemon = True
        self.rotation_thread.start()
        logger.info("IP rotation thread started")
    
    def stop_ip_rotation(self):
        """Stop the IP rotation thread"""
        if not self.rotation_thread or not self.rotation_thread.is_alive():
            logger.info("IP rotation is not running")
            return
        
        logger.info("Stopping IP rotation thread...")
        self.stop_event.set()
        self.rotation_thread.join(timeout=5)
        logger.info("IP rotation thread stopped")
    
    def get_proxy_url(self):
        """Get the Tor proxy URL for use with requests"""
        return f'socks5h://127.0.0.1:{self.tor_port}'
    
    def get_proxy_dict(self):
        """Get the proxy dictionary for use with requests"""
        proxy_url = self.get_proxy_url()
        return {
            'http': proxy_url,
            'https': proxy_url
        }
    
    def test_connection(self):
        """Test the Tor connection"""
        try:
            ip = self.get_current_ip()
            if ip:
                logger.info(f"Tor connection successful. Current IP: {ip}")
                return True, ip
            else:
                logger.error("Failed to get IP through Tor")
                return False, None
        except Exception as e:
            logger.error(f"Error testing Tor connection: {e}")
            return False, str(e)

# Singleton instance
_tor_controller = None

def get_tor_controller():
    """Get the singleton TorController instance"""
    global _tor_controller
    if _tor_controller is None:
        _tor_controller = TorController()
    return _tor_controller

def init_tor():
    """Initialize and start Tor"""
    controller = get_tor_controller()
    try:
        controller.start_tor()
        return True
    except Exception as e:
        logger.error(f"Failed to initialize Tor: {e}")
        return False

def stop_tor():
    """Stop Tor"""
    global _tor_controller
    if _tor_controller:
        _tor_controller.stop_tor()
        _tor_controller = None
