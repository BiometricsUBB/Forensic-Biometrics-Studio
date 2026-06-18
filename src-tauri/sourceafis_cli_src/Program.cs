using System;
using System.IO;
using System.Text.Json;
using System.Reflection;
using SourceAFIS;
using System.Linq;
using System.Collections.Generic;

class Program
{
    static void Main(string[] args)
    {
        try
        {
            RunMatcher(args);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("CRITICAL RUNTIME ERROR: " + ex.ToString());
            if (ex.InnerException != null)
            {
                Console.Error.WriteLine("INNER EXCEPTION: " + ex.InnerException.ToString());
            }
            Environment.Exit(1);
        }
    }

    static void RunMatcher(string[] args)
    {
        string? imagePath = null;
        string? image2Path = null;
        string? outTemplate = null;
        string? outJson = null;
        int featureLimitOrThreshold = 10; 

        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--image" && i + 1 < args.Length) imagePath = args[++i];
            else if (args[i] == "--image2" && i + 1 < args.Length) image2Path = args[++i];
            else if (args[i] == "--out-template" && i + 1 < args.Length) outTemplate = args[++i];
            else if (args[i] == "--out-json" && i + 1 < args.Length) outJson = args[++i];
            else if (args[i] == "--limit" && i + 1 < args.Length) int.TryParse(args[++i], out featureLimitOrThreshold);
        }

        if (imagePath == null || outTemplate == null || outJson == null)
        {
            Console.WriteLine("Missing required arguments.");
            return;
        }

        var imgBytes = File.ReadAllBytes(imagePath);
        var image1 = new FingerprintImage(imgBytes);
        var template1 = new FingerprintTemplate(image1);
        double score = 0;

        var leftMinutiaeList = ExtractMinutiae(template1);
        var rightMinutiaeList = new List<object>();

        if (image2Path != null)
        {
            var img2Bytes = File.ReadAllBytes(image2Path);
            var image2 = new FingerprintImage(img2Bytes);
            var template2 = new FingerprintTemplate(image2);
            var matcher = new FingerprintMatcher(template1);
            score = matcher.Match(template2);

            rightMinutiaeList = ExtractMinutiae(template2);
        }

        File.WriteAllBytes(outTemplate, template1.ToByteArray());

        var resultDict = new 
        {
            matchScore = score,
            thresholdUsed = featureLimitOrThreshold,
            leftMinutiae = leftMinutiaeList,
            rightMinutiae = rightMinutiaeList,
            width = 500,
            height = 500
        };

        var jsonString = JsonSerializer.Serialize(resultDict);
        File.WriteAllText(outJson, jsonString);

        Console.WriteLine("SUCCESS");
    }

    private static List<object> ExtractMinutiae(FingerprintTemplate template)
    {
        var list = new List<object>();
        var field = typeof(FingerprintTemplate).GetField("minutiae", BindingFlags.NonPublic | BindingFlags.Instance);
        var rawMinutiae = field?.GetValue(template) as System.Collections.IEnumerable;

        if (rawMinutiae != null)
        {
            foreach (var m in rawMinutiae)
            {
                dynamic d = m;
                list.Add(new {
                    x = (double)d.Position.X,
                    y = (double)d.Position.Y,
                    direction = (double)d.Direction,
                    type = d.Type.ToString().ToLower()
                });
            }
        }
        return list;
    }
}