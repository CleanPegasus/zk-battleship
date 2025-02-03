#!/bin/bash
# Check if a circuit name was provided.
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <circuit_name>"
  exit 1
fi

# Assign the circuit name from the first argument.
circuit_name=$1

# Determine pot size based on circuit name
if [ "$circuit_name" = "battleship" ]; then
    pot_size=14
else
    pot_size=12
fi

# Create the output directory in case it doesn't exist.
mkdir -p build

Compile the circuit.
circom "circuits/${circuit_name}.circom" --r1cs --wasm --sym --c --output build/

# Generating powers of tau
# Phase 1

echo "Generating Powers of tau"
echo "Phase 1"

if [ ! -f "build/pot/pot${pot_size}_0001.ptau" ]; then
    snarkjs powersoftau new bn128 ${pot_size} build/pot/pot${pot_size}_0000.ptau -v 
    snarkjs powersoftau contribute build/pot/pot${pot_size}_0000.ptau build/pot/pot${pot_size}_0001.ptau --name="First contribution" -v
else
    echo "Powers of Tau file already exists. Skipping Phase 1."
fi

echo "Phase 2"

snarkjs powersoftau prepare phase2 build/pot/pot${pot_size}_0001.ptau build/pot/pot${pot_size}_${circuit_name}_final.ptau -v

# Set up the Groth16 proving system.
snarkjs groth16 setup "build/${circuit_name}.r1cs" "build/pot/pot${pot_size}_${circuit_name}_final.ptau" "build/${circuit_name}_keys/${circuit_name}_0000.zkey"

# Contribute to the phase 2 ceremony.
snarkjs zkey contribute "build/${circuit_name}_keys/${circuit_name}_0000.zkey" "build/${circuit_name}_keys/${circuit_name}_0001.zkey" \
  --name="1st Contributor Name" -v

# Export the verification key.
snarkjs zkey export verificationkey "build/${circuit_name}_keys/${circuit_name}_0001.zkey" "build/${circuit_name}_keys/${circuit_name}_vkey.json" 

# Export Solidity Verifier
snarkjs zkey export solidityverifier "build/${circuit_name}_keys/${circuit_name}_0001.zkey" "contracts/${circuit_name}_verifier.sol"

echo "All steps completed successfully."
