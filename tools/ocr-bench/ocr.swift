import Foundation
import ImageIO
import Vision

// Same engine as the Shortcuts "Extract Text from Image" action, same output format
// (=== T01-R0042 === marker from the file name): tests OCR changes without the iPhone.
for path in CommandLine.arguments.dropFirst() {
    let url = URL(fileURLWithPath: path)
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
          let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
        FileHandle.standardError.write("unreadable: \(path)\n".data(using: .utf8)!)
        continue
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["fr-FR"]
    request.usesLanguageCorrection = true
    try VNImageRequestHandler(cgImage: img).perform([request])
    print("=== \(url.deletingPathExtension().lastPathComponent) ===")
    for observation in request.results ?? [] {
        if let line = observation.topCandidates(1).first?.string { print(line) }
    }
}
