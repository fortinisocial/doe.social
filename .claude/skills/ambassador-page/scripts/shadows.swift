// Lifts shadows (faces under caps, backlit groups) with Core Image, like Photos' Shadows slider.
// 0.5 / 1.0 / 12 looked natural on the beach-tennis photo; 1.0 / 0.85 was too bright.
import Foundation
import CoreImage
import ImageIO
import UniformTypeIdentifiers

// usage: shadows <in> <out.png> <shadowAmount> <highlightAmount> <radius>
let a = CommandLine.arguments
let src = CIImage(contentsOf: URL(fileURLWithPath: a[1]))!
let f = CIFilter(name: "CIHighlightShadowAdjust")!
f.setValue(src, forKey: kCIInputImageKey)
f.setValue(Double(a[3])!, forKey: "inputShadowAmount")
f.setValue(Double(a[4])!, forKey: "inputHighlightAmount")
f.setValue(Double(a[5])!, forKey: "inputRadius")
let out = f.outputImage!.cropped(to: src.extent)
let ctx = CIContext()
let cg = ctx.createCGImage(out, from: out.extent)!
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: a[2]) as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, cg, nil)
CGImageDestinationFinalize(dest)
print("wrote", cg.width, "x", cg.height)
