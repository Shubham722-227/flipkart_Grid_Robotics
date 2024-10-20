"use client";

import React, { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import axios from "axios";

const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
const BACKEND_URL = process.env.BACKEND_URL;
console.log("Backend URL:", BACKEND_URL);

export function SnapAndAnalyze() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [brands, setBrands] = useState<string[]>([]);
  const [packageType, setPackageType] = useState<string[]>([]);
  const [extractedData, setExtractedData] = useState("");
  const [isFreshnessMode, setIsFreshnessMode] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [data, setData] = useState("");
  const [freshnessData, setFreshnessData] = useState<
    { status: string; item: string; shelfLifeDays: number; message: string }[]
  >([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  const performOCR = async (imageSrc: string) => {
    const base64Content = imageSrc.split(",")[1];
    const body = {
      requests: [
        {
          features: [
            { type: "LOGO_DETECTION", maxResults: 2 },
            { type: "OBJECT_LOCALIZATION", maxResults: 3 },
            { type: "TEXT_DETECTION" },
          ],
          image: {
            content: base64Content,
          },
        },
      ],
    };
    console.log("Performing OCR...");

    try {
      const response = await axios.post(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        body
      );
      console.log("Labels:", response.data.responses);
      setData(JSON.stringify(response.data.responses));

      if (
        Array.isArray(response.data.responses) &&
        response.data.responses.length > 0
      ) {
        const logos = response.data.responses[0].logoAnnotations || [];
        const objects =
          response.data.responses[0].localizedObjectAnnotations || [];
        const text = response.data.responses[0].textAnnotations || [];

        const textDescriptions = text
          .map((annotation: { description: string }) => annotation.description)
          .join(" ");
        setExtractedData(textDescriptions);

        const logoDescriptions = logos.map(
          (annotation: { description: string }) => annotation.description
        );
        setBrands(logoDescriptions);

        const objectNames = objects.map(
          (annotation: { name: string }) => annotation.name
        );
        setPackageType(objectNames);

        const img = new Image();
        img.src = imageSrc;

        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = img.width;
          canvas.height = img.height;
          if (ctx) {
            ctx.drawImage(img, 0, 0);

            // Draw logo bounding boxes
            logos.forEach(
              (annotation: {
                boundingPoly: { vertices: { x: number; y: number }[] };
              }) => {
                const vertices = annotation.boundingPoly.vertices;
                ctx.beginPath();
                ctx.moveTo(vertices[0].x, vertices[0].y);
                vertices.forEach((vertex, index) => {
                  if (index > 0) {
                    ctx.lineTo(vertex.x, vertex.y);
                  }
                });
                ctx.closePath();
                ctx.lineWidth = 2;
                ctx.strokeStyle = "red";
                ctx.stroke();
              }
            );

            // Draw object bounding boxes
            objects.forEach(
              (annotation: {
                boundingPoly: {
                  normalizedVertices: { x: number; y: number }[];
                };
              }) => {
                const vertices = annotation.boundingPoly.normalizedVertices;
                ctx.beginPath();
                ctx.moveTo(
                  vertices[0].x * canvas.width,
                  vertices[0].y * canvas.height
                );
                vertices.forEach((vertex, index) => {
                  if (index > 0) {
                    ctx.lineTo(
                      vertex.x * canvas.width,
                      vertex.y * canvas.height
                    );
                  }
                });
                ctx.closePath();
                ctx.lineWidth = 2;
                ctx.strokeStyle = "blue";
                ctx.stroke();
              }
            );
          }

          setCapturedImage(canvas.toDataURL());
        };
      }
    } catch (error) {
      console.log(error);
    }
    return "Sample OCR Text: Product XYZ\nNet Wt: 100g\nMfg Date: 01/01/2024";
  };

  const performFreshness = async (imageSrc: string) => {
    console.log("Performing freshness test...");
    try {
      const response = await axios.post(`${BACKEND_URL}/predict/`, {
        image_base64: imageSrc.split(",")[1],
      });
      console.log(response.data.data);
      const data = response.data;
      if (data.status === "success") {
        setFreshnessData([
          {
            status: data.data.status,
            item: data.data.item,
            shelfLifeDays: data.data.shelf_life_days,
            message: data.data.message,
          },
        ]);

        console.log("Freshness Data:", freshnessData);
      } else {
        alert("Failed to process image");
      }
    } catch (error) {
      console.log(error);
    }
    return "Freshness: 85% - Good condition";
  };

  const capture = useCallback(async () => {
    setBrands([]);
    setPackageType([]);
    setExtractedData("");
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
      setIsProcessing(true);
      console.log(isFreshnessMode);
      if (!isFreshnessMode) {
        performOCR(imageSrc);
      } else {
        performFreshness(imageSrc);
      }

      setIsProcessing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFreshnessMode]);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold text-center mb-6">Snap & Analyze</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Live Camera Feed</CardTitle>
          </CardHeader>
          <CardContent>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="w-full rounded-lg"
            />
            <div className="mt-4 flex justify-between items-center">
              <Button onClick={capture} disabled={isProcessing}>
                {isProcessing ? "Processing..." : "Capture"}
              </Button>
              <div className="flex items-center space-x-2">
                <Switch
                  id="freshness-mode"
                  checked={isFreshnessMode}
                  onCheckedChange={() => setIsFreshnessMode(!isFreshnessMode)}
                />
                <Label htmlFor="freshness-mode">Freshness Test Mode</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {isFreshnessMode ? "Freshness Analysis" : "Extracted Data"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {capturedImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full mb-4 rounded-lg"
              />
            )}
            <div className="bg-muted p-4 rounded-lg min-h-[100px] mb-4">
              {!isFreshnessMode && (
                <>
                  {brands.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-lg font-bold mb-2">Brands</h3>
                      <div className="text-sm font-semibold">
                        <div>Count: {brands.length}</div>
                        <div>Detected: {brands.join(", ")}</div>
                      </div>
                    </div>
                  )}
                  {packageType.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-lg font-bold mb-2">Package Types</h3>
                      <div className="text-sm font-semibold">
                        <div>Count: {packageType.length}</div>
                        <ul className="list-disc list-inside">
                          {packageType.map((type, index) => (
                            <li key={index}>{type}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {extractedData !== "" && (
                    <div className="mb-4">
                      <h3 className="text-lg font-bold mb-2">Extracted Data</h3>
                      <div className="text-sm font-semibold">
                        {extractedData}
                      </div>
                    </div>
                  )}
                </>
              )}
              {isFreshnessMode && freshnessData.length > 0 && (
                <div className="text-sm font-semibold">
                  {freshnessData.map((data, index) => (
                    <div key={index}>
                      <div>Freshness: {data.status}</div>
                      <div>Item: {data.item}</div>
                      <div>Shelf Life Days: {data.shelfLifeDays}</div>
                      <div>Message: {data.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
