<?php
// CSV-based storage system

class CSVStorage {
    private $dataDir;

    public function __construct($dataDir = null) {
        $this->dataDir = $dataDir ?: __DIR__ . '/../../data';

        // Create data directory if it doesn't exist
        if (!is_dir($this->dataDir)) {
            if (!@mkdir($this->dataDir, 0755, true)) {
                throw new Exception("Failed to create data directory: {$this->dataDir}. Check permissions.");
            }
        }

        // Check if directory is writable
        if (!is_writable($this->dataDir)) {
            throw new Exception("Data directory is not writable: {$this->dataDir}. Please set permissions to 755.");
        }

        // Create .htaccess to protect data directory
        $htaccessPath = $this->dataDir . '/.htaccess';
        if (!file_exists($htaccessPath)) {
            if (!@file_put_contents($htaccessPath, "Deny from all\n")) {
                // Not critical, just log it
                error_log("Warning: Could not create .htaccess in data directory");
            }
        }
    }

    private function getFilePath($collection) {
        return $this->dataDir . '/' . $collection . '.csv';
    }

    // Read all records from a collection
    public function findAll($collection) {
        $filePath = $this->getFilePath($collection);

        if (!file_exists($filePath)) {
            return [];
        }

        $records = [];
        $handle = fopen($filePath, 'r');

        if ($handle) {
            // Read header
            $header = fgetcsv($handle);

            if ($header) {
                $headerCount = count($header);

                // Read data rows
                while (($row = fgetcsv($handle)) !== false) {
                    // Skip empty rows
                    if (empty($row) || (count($row) === 1 && $row[0] === null)) {
                        continue;
                    }

                    // Pad row with empty strings if it has fewer columns than header
                    $rowCount = count($row);
                    if ($rowCount < $headerCount) {
                        $row = array_pad($row, $headerCount, '');
                    } elseif ($rowCount > $headerCount) {
                        // Trim extra columns if row has more than header
                        $row = array_slice($row, 0, $headerCount);
                    }

                    $record = array_combine($header, $row);
                    $records[] = $record;
                }
            }

            fclose($handle);
        }

        return $records;
    }

    // Find records matching filter
    public function find($collection, $filter = []) {
        $allRecords = $this->findAll($collection);

        if (empty($filter)) {
            return $allRecords;
        }

        return array_filter($allRecords, function($record) use ($filter) {
            foreach ($filter as $key => $value) {
                if (!isset($record[$key]) || $record[$key] != $value) {
                    return false;
                }
            }
            return true;
        });
    }

    // Find one record
    public function findOne($collection, $filter) {
        $results = $this->find($collection, $filter);
        return !empty($results) ? reset($results) : null;
    }

    // Insert a new record
    public function insert($collection, $data) {
        $filePath = $this->getFilePath($collection);
        $fileExists = file_exists($filePath);

        // Add ID and timestamp if not present
        if (!isset($data['id'])) {
            $data['id'] = uniqid('', true);
        }
        if (!isset($data['created_at'])) {
            $data['created_at'] = date('Y-m-d H:i:s');
        }

        $handle = fopen($filePath, 'a');

        if ($handle) {
            // Lock file for writing
            flock($handle, LOCK_EX);

            // Write header if new file
            if (!$fileExists || filesize($filePath) === 0) {
                fputcsv($handle, array_keys($data));
            } else {
                // Validate columns match
                $existingData = $this->findAll($collection);
                if (!empty($existingData)) {
                    $existingKeys = array_keys($existingData[0]);
                    $newKeys = array_keys($data);

                    // Ensure all keys are present
                    foreach ($existingKeys as $key) {
                        if (!isset($data[$key])) {
                            $data[$key] = '';
                        }
                    }

                    // Reorder data to match existing columns
                    $orderedData = [];
                    foreach ($existingKeys as $key) {
                        $orderedData[$key] = $data[$key] ?? '';
                    }
                    $data = $orderedData;
                }
            }

            // Write data
            fputcsv($handle, array_values($data));

            // Unlock and close
            flock($handle, LOCK_UN);
            fclose($handle);

            return $data['id'];
        }

        return false;
    }

    // Update records
    public function update($collection, $filter, $newData) {
        $allRecords = $this->findAll($collection);
        $updated = 0;

        foreach ($allRecords as &$record) {
            $matches = true;
            foreach ($filter as $key => $value) {
                if (!isset($record[$key]) || $record[$key] != $value) {
                    $matches = false;
                    break;
                }
            }

            if ($matches) {
                foreach ($newData as $key => $value) {
                    $record[$key] = $value;
                }
                $record['updated_at'] = date('Y-m-d H:i:s');
                $updated++;
            }
        }

        if ($updated > 0) {
            $this->writeAll($collection, $allRecords);
        }

        return $updated;
    }

    // Delete records
    public function delete($collection, $filter) {
        $allRecords = $this->findAll($collection);
        $deleted = 0;

        $filtered = array_filter($allRecords, function($record) use ($filter, &$deleted) {
            foreach ($filter as $key => $value) {
                if (!isset($record[$key]) || $record[$key] != $value) {
                    return true; // Keep record
                }
            }
            $deleted++;
            return false; // Remove record
        });

        if ($deleted > 0) {
            $this->writeAll($collection, array_values($filtered));
        }

        return $deleted;
    }

    // Write all records (overwrites file)
    private function writeAll($collection, $records) {
        if (empty($records)) {
            // Clear file
            file_put_contents($this->getFilePath($collection), '');
            return;
        }

        $filePath = $this->getFilePath($collection);
        $handle = fopen($filePath, 'w');

        if ($handle) {
            flock($handle, LOCK_EX);

            // Write header
            fputcsv($handle, array_keys($records[0]));

            // Write data
            foreach ($records as $record) {
                fputcsv($handle, array_values($record));
            }

            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    // Get count of records
    public function count($collection, $filter = []) {
        return count($this->find($collection, $filter));
    }

    // Initialize default admin
    public function initDefaultAdmin() {
        $admins = $this->findAll('admins');

        if (empty($admins)) {
            $this->insert('admins', [
                'email' => 'admin@hiveparty.com',
                'password' => password_hash('admin123', PASSWORD_BCRYPT),
                'name' => 'Admin',
                'role' => 'admin',
                'isActive' => '1',
                'last_login' => ''
            ]);
        }
    }
}

// Initialize storage
try {
    $storage = new CSVStorage();
    $storage->initDefaultAdmin();
} catch (Exception $e) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode([
        'error' => 'Storage initialization failed',
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
    exit();
}
