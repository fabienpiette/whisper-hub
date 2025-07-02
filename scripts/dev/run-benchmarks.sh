#!/bin/bash
set -e

# Benchmark Execution Script
# Runs performance benchmarks and generates reports

echo "🏃 Running performance benchmarks..."

# Create benchmarks directory
mkdir -p benchmarks

# Run benchmarks with memory profiling
echo "📊 Running service benchmarks..."
go test -bench=. -benchmem -run=^$ ./internal/service > benchmarks/service-bench.txt 2>&1

# Run converter-specific benchmarks
echo "🔄 Running converter benchmarks..."
go test -bench=Benchmark.*Converter -benchmem -run=^$ ./internal/service > benchmarks/converter-bench.txt 2>&1

# Run bitrate strategy benchmarks
echo "⚡ Running bitrate strategy benchmarks..."
go test -bench=BenchmarkBitrateStrategy -benchmem -run=^$ ./internal/service > benchmarks/bitrate-bench.txt 2>&1

echo "📋 Benchmark Results:"
echo "===================="

echo ""
echo "🔧 Service Benchmarks:"
cat benchmarks/service-bench.txt | grep -E "Benchmark.*-[0-9]+" || echo "No service benchmarks found"

echo ""
echo "🔄 Converter Benchmarks:"  
cat benchmarks/converter-bench.txt | grep -E "Benchmark.*-[0-9]+" || echo "No converter benchmarks found"

echo ""
echo "⚡ Bitrate Strategy Benchmarks:"
cat benchmarks/bitrate-bench.txt | grep -E "Benchmark.*-[0-9]+" || echo "No bitrate benchmarks found"

echo ""
echo "✅ Benchmark analysis complete. Results saved in benchmarks/ directory."