// Removes a logo's background with macOS Vision (the same subject lift as Preview).
// usage: swiftc -O lift.swift -o lift && ./lift <in> <out.png> <x,y,w,h crop, y from top>

import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
let input = URL(fileURLWithPath: args[1]), output = URL(fileURLWithPath: args[2])
// Crop (x, y from top, w, h) first so the frame lines on the sides aren't part of the subject.
let crop = args[3].split(separator: ",").map { CGFloat(Double($0)!) }
let src = CIImage(contentsOf: input)!
let h = src.extent.height
let cropped = src.cropped(to: CGRect(x: crop[0], y: h - crop[1] - crop[3], width: crop[2], height: crop[3]))
let ctx = CIContext()
let cg = ctx.createCGImage(cropped, from: cropped.extent)!

let req = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(cgImage: cg)
try handler.perform([req])
guard let obs = req.results?.first else { print("no subject found"); exit(1) }
print("instances:", obs.allInstances.count)
let buf = try obs.generateMaskedImage(ofInstances: obs.allInstances, from: handler, croppedToInstancesExtent: true)
let out = CIImage(cvPixelBuffer: buf)
let outCG = ctx.createCGImage(out, from: out.extent)!
let dest = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, outCG, nil)
CGImageDestinationFinalize(dest)
print("wrote", outCG.width, "x", outCG.height)
