import { createStackNavigator } from '@react-navigation/stack';
import React, { Component } from 'react';
import { AppState, BackHandler } from 'react-native';
import {
  BarcodeTracking,
  BarcodeTrackingBasicOverlay,
  BarcodeTrackingSettings,
  Symbology,
} from 'scandit-react-native-datacapture-barcode';
import {
  Camera,
  CameraSettings,
  DataCaptureContext,
  DataCaptureView,
  FrameSourceState,
  VideoResolution,
} from 'scandit-react-native-datacapture-core';

import { Button } from './Button';
import { requestCameraPermissionsIfNeeded } from './camera-permission-handler';
import { styles } from './styles';

const Stack = createStackNavigator();

export class ScanPage extends Component {

  constructor() {
    super();

    // Create data capture context using your license key.
    this.dataCaptureContext = DataCaptureContext.forLicenseKey('-- ENTER YOUR SCANDIT LICENSE KEY HERE --');
    this.viewRef = React.createRef();

    this.results = {};
  }

  componentDidMount() {
    AppState.addEventListener('change', this.handleAppStateChange);
    this.setupScanning();

    this.props.navigation.addListener('focus', () => {
      this.results = {};
    });
  }

  componentWillUnmount() {
    AppState.removeEventListener('change', this.handleAppStateChange);
    this.dataCaptureContext.dispose();
  }

  handleAppStateChange = async (nextAppState) => {
    if (nextAppState.match(/inactive|background/)) {
      this.stopCapture();
    } else {
      this.startCapture();
    }
  }

  startCapture() {
    this.startCamera();
    this.barcodeTracking.isEnabled = true;
  }

  stopCapture() {
    this.barcodeTracking.isEnabled = false;
    this.stopCamera();
  }

  goToResults() {
    this.props?.navigation?.navigate('results', { results: this.results });
  }

  stopCamera() {
    if (this.camera) {
      this.camera.switchToDesiredState(FrameSourceState.Off);
    }
  }

  startCamera() {
    if (!this.camera) {
      // Use the world-facing (back) camera and set it as the frame source of the context. The camera is off by
      // default and must be turned on to start streaming frames to the data capture context for recognition.
      this.camera = Camera.default;
      this.dataCaptureContext.setFrameSource(this.camera);

      const cameraSettings = new CameraSettings();
      cameraSettings.preferredResolution = VideoResolution.FullHD;
      this.camera.applySettings(cameraSettings);
    }

    // Switch camera on to start streaming frames and enable the barcode tracking mode.
    // The camera is started asynchronously and will take some time to completely turn on.
    requestCameraPermissionsIfNeeded()
      .then(() => this.camera.switchToDesiredState(FrameSourceState.On))
      .catch(() => BackHandler.exitApp());
  }

  setupScanning() {
    // The barcode tracking process is configured through barcode tracking settings
    // which are then applied to the barcode tracking instance that manages barcode tracking.
    const settings = new BarcodeTrackingSettings();

    // The settings instance initially has all types of barcodes (symbologies) disabled. For the purpose of this
    // sample we enable a very generous set of symbologies. In your own app ensure that you only enable the
    // symbologies that your app requires as every additional enabled symbology has an impact on processing times.
    settings.enableSymbologies([
      Symbology.EAN13UPCA,
      Symbology.EAN8,
      Symbology.UPCE,
      Symbology.Code39,
      Symbology.Code128,
      Symbology.QR,
    ]);

    // Create new barcode tracking mode with the settings from above.
    this.barcodeTracking = BarcodeTracking.forContext(this.dataCaptureContext, settings);

    // Register a listener to get informed whenever a new barcode is tracked.
    this.barcodeTrackingListener = {
      didUpdateSession: (_, session) => {
        Object.values(session.trackedBarcodes).forEach(trackedBarcode => {
          const { data, symbology } = trackedBarcode.barcode;
          this.results[data] = { data, symbology };
        });
      }
    };

    this.barcodeTracking.addListener(this.barcodeTrackingListener);

    // Add a barcode tracking overlay to the data capture view to render the location of captured barcodes on top of
    // the video preview. This is optional, but recommended for better visual feedback.
    BarcodeTrackingBasicOverlay.withBarcodeTrackingForView(this.barcodeTracking, this.viewRef.current);
  }

  render() {
    return (
      <>
        <DataCaptureView style={{ flex: 1 }} context={this.dataCaptureContext} ref={this.viewRef} />
        <Button styles={{ ...styles.button, bottom: 36 }} textStyles={styles.buttonText} title='Done' onPress={() => this.goToResults()} />
      </>
    );
  };
}
